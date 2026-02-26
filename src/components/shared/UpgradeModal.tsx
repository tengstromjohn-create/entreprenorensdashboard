import { X, ShieldCheck, ArrowRight } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onBankId: () => void
  currentLevel: string
}

export function UpgradeModal({ isOpen, onClose, onBankId }: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="bg-green-50 rounded-full p-4">
            <ShieldCheck className="text-green-600" size={32} />
          </div>

          <h2 className="text-xl font-bold text-[#2D3436]">Lås upp full tillgång</h2>

          <p className="text-gray-600 text-sm">
            Med BankID-verifiering får du tillgång till AI-driven analys,
            skräddarsydda dokument och personliga rekommendationer.
          </p>

          <div className="w-full bg-[#F5F5F0] rounded-lg p-4 text-left">
            <p className="text-sm font-medium text-[#2D3436] mb-2">Med BankID får du:</p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">&#10003;</span>
                <span>AI-genererad analys med Johns expertis</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">&#10003;</span>
                <span>Startup Kit med skräddarsydda bolagsdokument</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">&#10003;</span>
                <span>Fullständig Corporate Health Check</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">&#10003;</span>
                <span>Integrerad jävskontroll för trygghet</span>
              </li>
            </ul>
          </div>

          <button
            onClick={onBankId}
            className="w-full bg-[#2D3436] text-white py-3 rounded-lg font-medium hover:bg-[#3d4446] transition-colors flex items-center justify-center gap-2"
          >
            Verifiera med BankID
            <ArrowRight size={16} />
          </button>

          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Inte just nu
          </button>
        </div>
      </div>
    </div>
  )
}
