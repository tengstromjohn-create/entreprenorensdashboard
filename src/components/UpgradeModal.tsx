import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppAuth } from '@/contexts/AuthContext';
import { Shield } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const { signInWithBankID } = useAppAuth();

  const handleBankID = async () => {
    await signInWithBankID();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Uppgradera ditt konto
          </DialogTitle>
          <DialogDescription>
            Verifiera dig med BankID för att få full tillgång till alla
            verktyg och funktioner.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="rounded-lg bg-secondary p-4 text-sm">
            <p className="font-medium mb-1">Med BankID får du:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Full tillgång till alla verktyg</li>
              <li>Verifierad identitet för juridiska dokument</li>
              <li>Högre säkerhetsnivå på ditt konto</li>
            </ul>
          </div>
          <Button onClick={handleBankID} className="w-full" size="lg">
            Verifiera med BankID
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Inte nu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
