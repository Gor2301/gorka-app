"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Pricing() {
  const t = useTranslations("pricing");
  const tiers = t.raw("tiers") as Array<{
    name: string;
    price: string;
    oldPrice?: string;
    promoBadge?: string;
    period: string;
    description: string;
    cta: string;
    features: string[];
  }>;

  return (
    <section className="section-padding bg-white">
      <div className="container-gorka">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gorka-dark mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-gray-600">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className="bg-gorka-cream rounded-2xl p-8 border border-gray-100 flex flex-col justify-between"
            >
              <div>
                <h3 className="text-xl font-bold text-gorka-dark mb-2">{tier.name}</h3>
                        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                          {tier.oldPrice && (
                            <span className="text-2xl font-semibold text-gray-400 line-through decoration-[#F01428] decoration-2">
                              {tier.oldPrice}
                            </span>
                          )}
                          <span className={`text-4xl font-extrabold ${tier.oldPrice ? "text-green-600" : "text-gorka-dark"}`}>
                            {tier.price}
                          </span>
                          <span className="text-gray-500 font-medium">{tier.period}</span>
                        </div>
                        <div className="h-8 mb-2 mt-1">
                          {tier.promoBadge && (
                            <span className="inline-block bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                              {tier.promoBadge}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-6">{tier.description}</p>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="text-[#F01428] mt-0.5">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href={index === 3 ? "/contact" : "/register"}
              className={`w-full block text-center py-3 rounded-lg font-semibold transition ${
              index === 2
              ? "bg-gorka-violet text-white hover:bg-gorka-violet/90 shadow-md"
              : "bg-white text-gorka-dark border border-gray-300 hover:bg-gray-50"
              }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Clear Costs Section */}
        <div className="max-w-4xl mx-auto bg-gorka-cream p-8 md:p-12 rounded-2xl border border-gray-100">
          <h3 className="text-2xl font-bold text-gorka-dark mb-6">{t("costsTitle")}</h3>
          
          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>{t("costsIntro")}</p>
            
            <div>
              <h4 className="font-semibold text-gorka-dark mb-2">{t("byopTitle")}</h4>
              <p>{t("byopDesc")}</p>
            </div>

            <div>
              <h4 className="font-semibold text-gorka-dark mb-2">{t("managedTitle")}</h4>
              <p>{t("managedDesc")}</p>
            </div>

            <p>{t("meteredDesc")}</p>
            <p className="font-medium text-gorka-dark">{t("reviewDesc")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}