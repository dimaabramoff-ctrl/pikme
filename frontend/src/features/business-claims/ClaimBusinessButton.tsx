import React from 'react';
import { Building2, CheckCircle } from 'lucide-react';

interface ClaimBusinessButtonProps {
  salonId?: string;
  googlePlaceId?: string;
  salonName: string;
  isPickmePartner?: boolean;
  onClaimClick: () => void;
  className?: string;
  label?: string;
  variant?: 'primary' | 'secondary';
}

export const ClaimBusinessButton: React.FC<ClaimBusinessButtonProps> = ({
  salonId,
  googlePlaceId,
  salonName,
  isPickmePartner = false,
  onClaimClick,
  className = '',
  label = 'Salon übernehmen',
  variant = 'primary',
}) => {
  if (!salonId && !googlePlaceId) {
    return null;
  }

  if (isPickmePartner) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${className}`}>
        <CheckCircle size={16} className="text-green-600" />
        <span className="text-xs font-medium text-green-700">
          PickMe-Partner
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={onClaimClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${variant === 'secondary' ? 'border border-[#d5e1e4] bg-white text-[#163740] hover:bg-[#f7fbfb]' : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'} ${className}`}
      title={`Salon ${salonName} übernehmen`}
    >
      <Building2 size={16} />
      <span>{label}</span>
    </button>
  );
};
