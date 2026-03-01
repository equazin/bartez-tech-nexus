import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EnterpriseCTAProps {
  badge?: string;
  badgeIcon?: LucideIcon;
  title: string;
  highlight: string;
  description: string;
  primaryLabel: string;
  primaryTo: string;
  secondaryLabel?: string;
  secondaryTo?: string;
  variant?: "default" | "compact" | "wide";
}

const EnterpriseCTA = ({
  badge,
  badgeIcon: BadgeIcon,
  title,
  highlight,
  description,
  primaryLabel,
  primaryTo,
  secondaryLabel,
  secondaryTo,
  variant = "default",
}: EnterpriseCTAProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-2xl border border-border/40 bg-card ${
        variant === "compact" ? "p-8 lg:p-12" : "p-10 md:p-14 lg:p-20"
      }`}
    >
      {/* Background effects */}
      <div className="absolute inset-0 hero-grid opacity-10 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full pointer-events-none" 
        style={{ background: "radial-gradient(ellipse, hsl(var(--primary) / 0.06), transparent 70%)" }}
      />

      <div className="relative text-center">
        {badge && (
          <span className="enterprise-badge mb-6 inline-flex">
            {BadgeIcon && <BadgeIcon size={12} />}
            {badge}
          </span>
        )}
        <h2
          className={`font-display font-bold text-foreground tracking-tight leading-[1.1] ${
            variant === "compact"
              ? "text-xl md:text-2xl lg:text-3xl"
              : "text-2xl md:text-3xl lg:text-4xl"
          }`}
        >
          {title}
          <br className="hidden sm:block" />
          <span className="text-gradient"> {highlight}</span>
        </h2>
        <p
          className={`mx-auto mt-4 text-muted-foreground leading-relaxed ${
            variant === "compact" ? "max-w-md text-sm" : "max-w-lg text-sm md:text-base"
          }`}
        >
          {description}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to={primaryTo}>
            <Button
              size="lg"
              className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 glow-sm h-11 px-7 text-sm"
            >
              {primaryLabel} <ArrowRight size={14} className="ml-2" />
            </Button>
          </Link>
          {secondaryLabel && secondaryTo && (
            <Link to={secondaryTo}>
              <Button
                size="lg"
                variant="outline"
                className="border-border/60 text-foreground hover:bg-secondary h-11 px-7 text-sm"
              >
                {secondaryLabel}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default EnterpriseCTA;