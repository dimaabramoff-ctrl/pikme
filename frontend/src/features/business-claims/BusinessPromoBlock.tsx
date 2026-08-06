import React, { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';

interface BusinessPromoBlockProps {
  onClickFindBusiness: () => void;
  onClickLearnMore: () => void;
}

const PROMO_MESSAGES = [
  {
    headline: 'Ist das Ihr Salon?',
    tagline: 'Übernehmen Sie Ihr Profil und verwalten Sie Termine, Mitarbeiter und freie Zeiten.',
  },
  {
    headline: 'Ist das Ihr Salon?',
    tagline: 'Übernehmen Sie Ihr Profil und verwalten Sie Termine, Mitarbeiter und freie Zeiten.',
  },
];

export const BusinessPromoBlock: React.FC<BusinessPromoBlockProps> = ({
  onClickFindBusiness,
  onClickLearnMore,
}) => {
  // Стабильный выбор сообщения по времени сессии
  const message = useMemo(() => {
    const index = Math.floor(Date.now() / (1000 * 60 * 60)) % PROMO_MESSAGES.length;
    return PROMO_MESSAGES[index];
  }, []);

  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 md:p-8 my-6">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        {/* Left: Text Content */}
        <div>
          <div className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            FÜR UNTERNEHMEN
          </div>

          <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
            {message.headline}
          </h3>

          <p className="text-gray-600 text-sm md:text-base mb-6">
            {message.tagline}
          </p>

          <div className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
            30 Tage kostenlos
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClickFindBusiness}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
            >
              Geschäft übernehmen
              <ArrowRight size={16} />
            </button>

            <button
              onClick={onClickLearnMore}
              className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              So funktioniert es
            </button>
          </div>
        </div>

        {/* Right: Simple Animation / Illustration */}
        <div className="hidden md:flex justify-center">
          <div className="w-32 h-32 bg-white rounded-lg shadow-md p-4 flex flex-col justify-center items-center animate-pulse">
            <div className="text-3xl mb-2">📱</div>
            <div className="text-xs text-gray-600 text-center font-medium">
              Dashboard
            </div>
            <div className="mt-3 space-y-2 w-full">
              <div className="h-2 bg-green-200 rounded w-3/4"></div>
              <div className="h-2 bg-red-200 rounded w-2/3"></div>
              <div className="h-2 bg-blue-200 rounded w-4/5"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
