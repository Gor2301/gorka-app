"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FAQItem = {
  question: string;
  answer: string;
};

type FAQCategory = {
  title: string;
  items: FAQItem[];
};

export default function FAQ() {
  const t = useTranslations("faq");
  const intro = t("intro");
  const categories = t.raw("categories") as FAQCategory[];
  const closing = t.raw("closing") as {
    title: string;
    body: string;
    cta: string;
  };

  return (
    <section className="section-padding bg-white">
      <div className="container-gorka max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gorka-dark mb-4">
          {t("title")}
        </h2>

        <p className="text-center text-gray-600 max-w-2xl mx-auto mb-16 leading-relaxed">
          {intro}
        </p>

        <div className="space-y-12">
          {categories.map((category, catIndex) => (
            <div key={catIndex}>
              <h3 className="text-xl md:text-2xl font-semibold text-[#F01428] mb-6 pb-3 border-b border-gray-200">
                {category.title}
              </h3>

              <Accordion multiple={false} className="w-full">
                {category.items.map((item, itemIndex) => (
                  <AccordionItem
                    key={itemIndex}
                    value={`cat-${catIndex}-item-${itemIndex}`}
                  >
                    <AccordionTrigger className="text-left text-gorka-dark font-medium hover:text-[#F01428]">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-600 leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>

        <div className="mt-20 rounded-2xl bg-gorka-cream p-8 md:p-12 text-center border border-gray-100">
          <h3 className="text-2xl md:text-3xl font-bold text-gorka-dark mb-3">
            {closing.title}
          </h3>
          <p className="text-gray-600 max-w-2xl mx-auto mb-6 leading-relaxed">
            {closing.body}
          </p>
          <a
            href="/contact"
            className="inline-block px-8 py-3 bg-[#F01428] text-white rounded-lg font-semibold hover:bg-[#F01428]/90 transition"
          >
            {closing.cta}
          </a>
        </div>
      </div>
    </section>
  );
}