"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
  const t = useTranslations("finalCta");
  
  return (
    <section className="section-padding-lg bg-gorka-violet">
      <div className="container-gorka text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
          {t("title")}
        </h2>
        <Link href="/en/contact">
          <button className="px-8 py-3 bg-white text-gorka-violet rounded-lg font-semibold hover:bg-gray-100 transition inline-flex items-center gap-2">
            {t("cta")}
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </section>
  );
}