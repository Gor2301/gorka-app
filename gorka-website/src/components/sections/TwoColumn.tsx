"use client";

import { useTranslations } from "next-intl";
import { Shield, Sparkles } from "lucide-react";

export default function TwoColumn() {
  const t = useTranslations("twoColumn");
  
  return (
    <section className="section-padding bg-white">
      <div className="container-gorka">
        {/* Block 1: Data Security */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
          <div className="order-2 lg:order-1">
            <div className="w-12 h-12 bg-gorka-violet/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-gorka-violet" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-gorka-dark mb-4">
              {t("security.title")}
            </h3>
            <p className="text-gray-600 text-base leading-relaxed mb-4">
              {t("security.description")}
            </p>
            <p className="text-gray-600 text-base leading-relaxed">
              {t("security.detail")}
            </p>
          </div>
          <div className="order-1 lg:order-2 bg-gorka-cream rounded-xl p-8 border border-gray-100 flex items-center justify-center min-h-[200px]">
            <div className="text-center">
              <Shield className="w-16 h-16 text-gorka-violet/40 mx-auto mb-3" />
              <p className="text-sm text-gray-400">🔒 Local-first architecture</p>
            </div>
          </div>
        </div>

        {/* Block 2: AI Copilot */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="w-12 h-12 bg-gorka-violet/10 rounded-lg flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-gorka-violet" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-gorka-dark mb-4">
              {t("copilot.title")}
            </h3>
            <p className="text-gray-600 text-base leading-relaxed mb-4">
              {t("copilot.description")}
            </p>
            <p className="text-gray-600 text-base leading-relaxed">
              {t("copilot.detail")}
            </p>
          </div>
          <div className="bg-gorka-cream rounded-xl p-8 border border-gray-100 flex items-center justify-center min-h-[200px]">
            <div className="text-center">
              <Sparkles className="w-16 h-16 text-gorka-violet/40 mx-auto mb-3" />
              <p className="text-sm text-gray-400">🤖 AI Copilot</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}