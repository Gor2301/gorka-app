
import { AlertTriangle, X } from 'lucide-react';

interface DeclarationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  connectorName: string;
}

export function DeclarationModal({ isOpen, onClose, onAccept, connectorName }: DeclarationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-xl font-bold">THIRD-PARTY CONNECTION DECLARATION</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-lg font-medium">
            You are about to connect GORKA to: <span className="text-blue-600">{connectorName}</span>
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="font-semibold text-red-700">🔴 IMPORTANT NOTICE:</p>
            <p className="text-red-700 mt-2">
              GORKA provides the technical capability to connect to third-party services.
              However, GORKA does NOT control, and is NOT responsible for:
            </p>
            <ul className="list-disc list-inside text-red-700 mt-2 space-y-1">
              <li>The security, privacy, or data handling practices of third parties</li>
              <li>How third parties store, process, or transmit your data</li>
              <li>Compliance of third parties with applicable data protection laws</li>
              <li>Data breaches or security incidents occurring at third parties</li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-700">✅ By connecting this service, you acknowledge and agree that:</p>
            <ol className="list-decimal list-inside text-blue-700 mt-2 space-y-1">
              <li>You have reviewed and accepted the third party's privacy policy</li>
              <li>You assume all responsibility for any data transmitted</li>
              <li>You may disconnect this service at any time</li>
            </ol>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="font-semibold text-green-700">🔒 GORKA's Commitment:</p>
            <ul className="list-disc list-inside text-green-700 mt-2 space-y-1">
              <li>Your data remains on your infrastructure by default</li>
              <li>No data is shared without your explicit consent</li>
              <li>All third-party credentials are encrypted at rest</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={onAccept}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              I UNDERSTAND & CONNECT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}