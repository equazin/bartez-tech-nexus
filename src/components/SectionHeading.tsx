import { motion } from "framer-motion";

interface SectionHeadingProps {
  badge?: string;
  title: string;
  highlight?: string;
  description?: string;
  center?: boolean;
  large?: boolean;
}

const SectionHeading = ({ badge, title, highlight, description, center = true, large = false }: SectionHeadingProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`mb-14 lg:mb-20 ${center ? "text-center" : ""}`}
    >
      {badge && (
        <span className="enterprise-badge mb-6 inline-flex">
          {badge}
        </span>
      )}
      <h2 className={`font-display font-bold tracking-tight text-foreground leading-[1.1] ${
        large 
          ? "text-3xl md:text-4xl lg:text-5xl" 
          : "text-2xl md:text-3xl lg:text-4xl"
      }`}>
        {title}{" "}
        {highlight && <span className="text-gradient">{highlight}</span>}
      </h2>
      {description && (
        <p className={`mt-5 text-muted-foreground leading-relaxed ${
          center ? "mx-auto max-w-2xl" : "max-w-xl"
        } ${large ? "text-base md:text-lg" : "text-sm md:text-base"}`}>
          {description}
        </p>
      )}
    </motion.div>
  );
};

export default SectionHeading;