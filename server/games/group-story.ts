import type { GameHandler, ServerGameSession, GameServer } from '../types.js';
import { broadcastSessionState, CountdownTimer, hostTalk } from './utils.js';
import { NanoBananaImageGenerator } from '../utils/nano-banana-image-generator.js';
import OpenAI from 'openai';

export interface GroupStoryState {
  phase: 'answering' | 'generating' | 'displaying' | 'error';
  questions: Array<{ playerId: string; question: string }>;
  answers: Record<string, string>; // playerId -> answer
  currentStory: { text: string; imagePrompt: string } | null;
  storyHistory: Array<{ text: string; imagePrompt: string; round: number }>;
  currentRound: number;
  timeRemaining: number;
  errorMessage?: string;
}

const ANSWERING_TIME = 30; // seconds

// Module-level timer for answering phase
let answerTimer: CountdownTimer | null = null;

// Fallback questions if OpenAI generation fails
const FALLBACK_QUESTIONS = [
  'Name a place',
  'Name a character',
  'What happens?',
  'What is the mood?',
  'Name an object',
  'What time of day is it?',
  'What color stands out?',
  'Who appears?',
];

/**
 * Generates unique questions for each player using OpenAI
 */
async function generateQuestions(playerCount: number, previousStory?: string): Promise<string[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const contextPrompt = previousStory
      ? `Continue building on this story: "${previousStory.substring(0, 200)}..."\n\n`
      : '';

    const prompt = `${contextPrompt}Generate exactly ${playerCount} unique creative questions about different aspects of a story.
Each question should ask for a SHORT answer (1-3 words).
Questions should cover different aspects like: setting, characters, events, themes, details, objects, time, mood.
Focus on the most important/basic questions first.
Return ONLY a JSON object with this structure: {"questions": ["question 1", "question 2", ...]}\n\nExamples:\n- "What is the main character's name?"\n- "Where does this take place?"\n- "What time of day is it?"\n- "What object is important?"\n- "What is the mood?"`;

    console.log(`[GroupStory] Generating ${playerCount} questions with OpenAI...`);

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'question_generation',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              questions: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['questions'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    const questions = parsed.questions as string[];

    // Validate we got enough questions
    if (!Array.isArray(questions) || questions.length < playerCount) {
      throw new Error(`Expected ${playerCount} questions, got ${questions?.length || 0}`);
    }

    // Trim to exact count if we got more
    const finalQuestions = questions.slice(0, playerCount);

    console.log('[GroupStory] Generated questions:', finalQuestions);
    return finalQuestions;
  } catch (error) {
    console.error('[GroupStory] Question generation failed, using fallbacks:', error);

    // Use fallback questions
    const questions: string[] = [];
    for (let i = 0; i < playerCount; i++) {
      questions.push(FALLBACK_QUESTIONS[i % FALLBACK_QUESTIONS.length]);
    }
    return questions;
  }
}

/**
 * Generates a story from player answers using OpenAI
 */
async function generateStory(session: ServerGameSession, io: GameServer): Promise<void> {
  const state = session.gameState as GroupStoryState;

  try {
    console.log('[GroupStory] Starting story generation...');

    // 1. Filter out empty answers
    const validAnswers = state.questions.filter((q) => {
      const answer = state.answers[q.playerId];
      return answer && answer.trim().length > 0;
    });

    // 2. Check if all answers are empty
    if (validAnswers.length === 0) {
      console.log('[GroupStory] All answers are empty, cannot generate story');
      state.phase = 'error';
      state.errorMessage = 'All players submitted empty answers. Please try again with some creative input!';
      broadcastSessionState(session, io);
      return;
    }

    // 3. Build context from previous story
    const previousStory =
      state.storyHistory.length > 0
        ? state.storyHistory[state.storyHistory.length - 1].text
        : null;

    // 4. Build questions and answers section (only valid answers)
    const questionsAndAnswers = validAnswers
      .map((q) => {
        const player = session.players.find((p) => p.id === q.playerId);
        const answer = state.answers[q.playerId];
        return `${player?.name}: ${q.question} → "${answer}"`;
      })
      .join('\n');

    // 3. Build the story generation prompt
    const storyPrompt = previousStory
      ? `Continue this story using the new details provided:

Previous story segment:
${previousStory}

New details from players:
${questionsAndAnswers}

Write one paragraph continuing the story in an engaging way. Incorporate the new details naturally.
Also create a detailed visual description for a DALL-E image that captures this story segment.

Return ONLY valid JSON with this structure:
{"text": "the story text", "imagePrompt": "detailed DALL-E prompt"}`
      : `Create an engaging story from these details provided by players:

${questionsAndAnswers}

Write one paragraph that weaves these details into a cohesive, creative narrative.
Also create a detailed visual description for a DALL-E image that captures the essence of this story.

Return ONLY valid JSON with this structure:
{"text": "the story text", "imagePrompt": "detailed DALL-E prompt"}`;

    console.log('[GroupStory] Calling OpenAI for story generation...');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: storyPrompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'story_generation',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The story text (one paragraph)' },
              imagePrompt: { type: 'string', description: 'Detailed image prompt' },
            },
            required: ['text', 'imagePrompt'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI for story generation');
    }

    const story = JSON.parse(content) as { text: string; imagePrompt: string };
    console.log('[GroupStory] Story generated successfully');

    // 4. Generate image
    console.log('[GroupStory] Generating image with DALL-E...');
    const imageGenerator = new NanoBananaImageGenerator();
    const imageBase64 = await imageGenerator.generateImage(story.imagePrompt);

    // 5. Update state
    state.currentStory = story;
    state.phase = 'displaying';

    // 6. Send image to TV via Socket.IO event (not in session state to avoid bloat)
    if (session.tvSocketId) {
      console.log('[GroupStory] Sending image to TV...');
      io.to(session.tvSocketId).emit('story:image', {
        round: state.currentRound,
        imageData: imageBase64,
      });
    }

    // 7. Broadcast state
    broadcastSessionState(session, io);

    // 8. Have avatar read the story (without speech bubble)
    if (state.currentStory) {
      console.log('[GroupStory] Avatar reading story...');
      await hostTalk(session, io, state.currentStory.text, { showBubble: false });
    }

    console.log('[GroupStory] Story generation complete!');
  } catch (error) {
    console.error('[GroupStory] Story generation failed:', error);
    state.phase = 'error';
    state.errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    broadcastSessionState(session, io);
  }
}

/**
 * Starts a new round of questions
 */
async function startAnsweringPhase(session: ServerGameSession, io: GameServer): Promise<void> {
  const state = session.gameState as GroupStoryState;

  // Clear any existing timer
  if (answerTimer) {
    answerTimer.stop();
    answerTimer = null;
  }

  // Generate questions (with context if continuing)
  const previousStory =
    state.storyHistory.length > 0
      ? state.storyHistory[state.storyHistory.length - 1].text
      : undefined;

  // Only generate questions for active players
  const activePlayers = session.players.filter(p => p.isActive);
  const questionTexts = await generateQuestions(activePlayers.length, previousStory);

  // Assign questions to active players only
  state.questions = activePlayers.map((player, index) => ({
    playerId: player.id,
    question: questionTexts[index] || FALLBACK_QUESTIONS[index % FALLBACK_QUESTIONS.length],
  }));

  state.answers = {};
  state.phase = 'answering';
  state.timeRemaining = ANSWERING_TIME;

  // Broadcast state
  broadcastSessionState(session, io);

  // Announce to players
  const roundMessage =
    state.currentRound === 1
      ? 'Time to create a story! Answer your questions.'
      : `Round ${state.currentRound}! Continue the story with your answers.`;

  hostTalk(session, io, roundMessage);

  // Start countdown timer
  answerTimer = new CountdownTimer({
    duration: ANSWERING_TIME,
    onTick: (timeRemaining) => {
      const currentState = session.gameState as GroupStoryState;
      if (!currentState || currentState.phase !== 'answering') {
        answerTimer?.stop();
        return;
      }
      currentState.timeRemaining = timeRemaining;
      broadcastSessionState(session, io);
    },
    onComplete: () => {
      const currentState = session.gameState as GroupStoryState;
      if (!currentState || currentState.phase !== 'answering') return;

      console.log('[GroupStory] Timer expired, transitioning to generating...');
      currentState.phase = 'generating';
      broadcastSessionState(session, io);
      generateStory(session, io); // Async, no await
    },
  });

  answerTimer.start();
  console.log('[GroupStory] Answering phase started');
}

/**
 * Checks if all active players have submitted answers
 */
function allPlayersSubmitted(state: GroupStoryState, session: ServerGameSession): boolean {
  const activePlayers = session.players.filter(p => p.isActive);
  return activePlayers.every((player) => state.answers[player.id] !== undefined);
}

export const groupStoryGame: GameHandler = {
  id: 'group-story',
  name: 'Group Story',
  description: 'Collaborate to create an illustrated story with AI',
  minPlayers: 2,
  maxPlayers: 10,

  async onStart(session, io) {
    console.log('[GroupStory] Game starting...');

    // Initialize game state
    const state: GroupStoryState = {
      phase: 'answering',
      questions: [],
      answers: {},
      currentStory: null,
      storyHistory: [],
      currentRound: 1,
      timeRemaining: ANSWERING_TIME,
    };

    session.gameState = state;

    // Start the first round
    await startAnsweringPhase(session, io);
  },

  onEnd(session, _io) {
    console.log('[GroupStory] Game ending...');

    // Clear timer
    if (answerTimer) {
      answerTimer.stop();
      answerTimer = null;
    }

    // Clear game state
    session.gameState = null;
  },

  onAction(session, io, playerId, action) {
    const state = session.gameState as GroupStoryState;
    if (!state) return;

    const player = session.players.find((p) => p.id === playerId);
    if (!player) return;

    // Handle submit-answer action
    if (action.type === 'submit-answer') {
      if (state.phase !== 'answering') {
        console.log('[GroupStory] Ignoring submit-answer in phase:', state.phase);
        return;
      }

      const answer = (action.payload && typeof (action.payload as any).answer === 'string')
        ? (action.payload as any).answer
        : undefined;
      if (typeof answer !== 'string') {
        console.log('[GroupStory] Invalid answer payload');
        return;
      }

      console.log(`[GroupStory] Player ${player.name} submitted answer: "${answer}"`);
      state.answers[playerId] = answer;

      // Check if all players have submitted
      if (allPlayersSubmitted(state, session)) {
        console.log('[GroupStory] All players submitted, transitioning to generating...');

        // Stop timer
        if (answerTimer) {
          answerTimer.stop();
          answerTimer = null;
        }

        // Transition to generating
        state.phase = 'generating';
        broadcastSessionState(session, io);
        generateStory(session, io); // Async, no await
      } else {
        // Just broadcast to show updated submission status
        broadcastSessionState(session, io);
      }

      return;
    }

    // Handle retry-generation action (GM only)
    if (action.type === 'retry-generation') {
      if (!player.isGameMaster) {
        console.log('[GroupStory] Non-GM tried to retry generation');
        return;
      }

      if (state.phase !== 'error') {
        console.log('[GroupStory] Retry attempted outside error phase');
        return;
      }

      console.log('[GroupStory] GM retrying story generation...');
      state.phase = 'generating';
      state.errorMessage = undefined;
      broadcastSessionState(session, io);
      generateStory(session, io); // Async, no await

      return;
    }

    // Handle retry-questions action (GM only) - restart the current round with new questions
    if (action.type === 'retry-questions') {
      if (!player.isGameMaster) {
        console.log('[GroupStory] Non-GM tried to retry questions');
        return;
      }

      if (state.phase !== 'error') {
        console.log('[GroupStory] Retry questions attempted outside error phase');
        return;
      }

      console.log('[GroupStory] GM retrying questions for current round...');
      state.errorMessage = undefined;
      startAnsweringPhase(session, io); // Async, no await

      return;
    }

    // Handle next-round action (GM only)
    if (action.type === 'next-round') {
      if (!player.isGameMaster) {
        console.log('[GroupStory] Non-GM tried to start next round');
        return;
      }

      if (state.phase !== 'displaying') {
        console.log('[GroupStory] Next round attempted outside displaying phase');
        return;
      }

      console.log('[GroupStory] GM starting next round...');

      // Save current story to history
      if (state.currentStory) {
        state.storyHistory.push({
          text: state.currentStory.text,
          imagePrompt: state.currentStory.imagePrompt,
          round: state.currentRound,
        });
      }

      // Increment round
      state.currentRound++;

      // Reset for new round
      state.currentStory = null;

      // Start new answering phase
      startAnsweringPhase(session, io); // Async, no await

      return;
    }
  },
};
