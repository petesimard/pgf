import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useState, useEffect } from 'react';

interface GameMasterControlsProps {
  showQRCode: boolean;
  tvZoom: number;
  onToggleQR: (show: boolean) => void;
  onSetTVZoom: (zoom: number) => void;
  onEndGame: () => void;
}

function GameMasterControls({ showQRCode, tvZoom, onToggleQR, onSetTVZoom, onEndGame }: GameMasterControlsProps) {
  // Local state for slider to show value while dragging
  const [localZoom, setLocalZoom] = useState(tvZoom);
  const [isDragging, setIsDragging] = useState(false);

  // Sync local zoom with session zoom only when not actively dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalZoom(tvZoom);
    }
  }, [tvZoom, isDragging]);
  return (
    <Card className="bg-card p-6 rounded-2xl mb-4 border-3 border-secondary shadow-playful">
      <h3 className="text-foreground mb-4 flex items-center gap-2 font-extrabold text-shadow-sm">
        Game Master Controls
      </h3>

      <div className="flex items-center justify-between mb-4 p-3 bg-primary/10 rounded-lg">
        <Label htmlFor="qr-toggle" className="text-sm font-bold text-foreground cursor-pointer">
          Show QR Code for new players
        </Label>
        <Switch
          id="qr-toggle"
          checked={showQRCode}
          onCheckedChange={onToggleQR}
        />
      </div>

      <div className="mb-4 p-3 bg-primary/10 rounded-lg">
        <Label htmlFor="tv-zoom" className="text-sm font-bold text-foreground mb-2 block">
          TV Zoom: {localZoom}%
        </Label>
        <Slider
          id="tv-zoom"
          min={20}
          max={200}
          step={5}
          value={[localZoom]}
          onValueChange={(value) => {
            setIsDragging(true);
            setLocalZoom(value[0]);
          }}
          onValueCommit={(value) => {
            setIsDragging(false);
            onSetTVZoom(value[0]);
          }}
          className="w-full"
        />
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button
          variant="destructive"
          onClick={onEndGame}
          className="flex-1 min-w-[120px] px-4 py-3 text-base font-bold rounded-full border-3 shadow-playful hover:shadow-playful-lg hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-playful-sm bg-gradient-to-b from-[#ff6b6b] to-[#ff4444]"
        >
          End Game
        </Button>
      </div>
    </Card>
  );
}

export default GameMasterControls;
