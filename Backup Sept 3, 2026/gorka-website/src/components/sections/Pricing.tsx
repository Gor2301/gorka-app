"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import Link from "next/link";

export default function Pricing() {
  const t = useTranslations("pricing");
  const tiers = t.raw("tiers") as Array<{
    name: string;
    price: string;
    description: string;
    cta: string;
    features: string[];
  }>;
  
  return (
    <section className="section-padding bg-gorka-cream">
      <div className="container-gorka">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gorka-dark mb-12">
          {t("title")}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier, index) => {
            const isEnterprise = tier.name === "Enterprise";
            const isProfessional = tier.name === "Professional";
            
            return (
              <div 
                key={index}
                className={`bg-white rounded-xl p-6 border ${
                  isProfessional ? 'border-gorka-violet shadow-lg' : 'border-gray-200'
                } ${isEnterprise ? 'bg-gorka-dark text-white' : ''}`}
              >
                <h3 className={`text-lg font-semibold ${isEnterprise ? 'text-white' : 'text-gorka-dark'}`}>
                  {tier.name}
                </h3>
                <div className="mt-2">
                  <span className={`text-3xl font-bold ${isEnterprise ? 'text-white' : 'text-gorka-dark'}`}>
                    {tier.price}
                  </span>
                  {tier.price !== "Contact us" && (
                    <span className={`text-sm ${isEnterprise ? 'text-gray-400' : 'text-gray-500'}`}>
                      /mo
                    </span>
                  )}
                </div>
                <p className={`text-sm mt-1 ${isEnterprise ? 'text-gray-400' : 'text-gray-500'}`}>
                  {tier.description}
                </p>
                
                <ul className="mt-4 space-y-2">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className={`flex items-start gap-2 text-sm ${
                      isEnterprise ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      <Check className="w-4 h-4 text-gorka-violet flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Link href={`/en/contact`}>
                  <button className={`w-full mt-6 px-6 py-2.5 text-sm font-semibold rounded-lg transition ${
                    isEnterprise 
                      ? 'bg-white text-gorka-dark hover:bg-gray-100' 
                      : 'bg-gorka-violet text-white hover:bg-gorka-violet/90'
                  }`}>
                    {tier.cta}
                  </button>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}