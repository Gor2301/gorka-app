"use client";

import { useTranslations } from "next-intl";
import { 
  Users, 
  FileSpreadsheet, 
  Bot, 
  CheckSquare, 
  Server 
} from "lucide-react";

const iconMap = {
  users: Users,
  file: FileSpreadsheet,
  bot: Bot,
  check: CheckSquare,
  server: Server,
};

export default function Features() {
  const t = useTranslations("features");
  const items = t.raw("items") as Array<{ title: string; description: string }>;
  
  // Map icons to each feature
  const iconKeys = ["users", "file", "bot", "check", "server"];
  
  return (
    <section className="section-padding bg-gorka-cream">
      <div className="container-gorka">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gorka-dark mb-12">
          {t("title")}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((item, index) => {
            const IconComponent = iconMap[iconKeys[index] as keyof typeof iconMap] || Bot;
            return (
              <div 
                key={index}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition border border-gray-100"
              >
                <div className="w-12 h-12 bg-gorka-violet/10 rounded-lg flex items-center justify-center mb-4">
                  <IconComponent className="w-6 h-6 text-gorka-violet" />
                </div>
                <h3 className="text-lg font-semibold text-gorka-dark mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}