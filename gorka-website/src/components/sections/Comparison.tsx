"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";

export default function Comparison() {
  const t = useTranslations("comparison");
  const rows = t.raw("rows") as Array<{ gorka: string; other: string }>;
  
  return (
    <section className="dark-section section-padding-lg">
      <div className="container-gorka">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">
          {t("title")}
        </h2>
        
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-2 gap-0">
            {/* Headers */}
            <div className="p-4 md:p-6 bg-white/10 border-b border-white/10">
              <span className="text-white font-semibold text-lg flex items-center gap-2">
                <Check className="w-5 h-5 text-gorka-violet" />
                GORKA
              </span>
            </div>
            <div className="p-4 md:p-6 bg-white/5 border-b border-white/10">
              <span className="text-gray-400 font-semibold text-lg flex items-center gap-2">
                <X className="w-5 h-5 text-red-400" />
                Spreadsheets / Legacy
              </span>
            </div>
            
            {/* Rows */}
            {rows.map((row, index) => (
              <div key={index} className="contents">
                <div className={`p-4 md:p-6 border-b border-white/5 ${index % 2 === 0 ? 'bg-white/5' : ''}`}>
                  <span className="text-white text-sm md:text-base">{row.gorka}</span>
                </div>
                <div className={`p-4 md:p-6 border-b border-white/5 ${index % 2 === 0 ? 'bg-white/5' : ''}`}>
                  <span className="text-gray-400 text-sm md:text-base">{row.other}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}