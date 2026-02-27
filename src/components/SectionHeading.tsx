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
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`mb-16 lg:mb-20 ${center ? "text-center" : ""}`}
    >
      {badge && (
        <span className="enterprise-badge mb-5 inline-flex">
          {badge}
        </span>
      )}
      <h2 className={`font-display font-bold tracking-tight text-foreground ${
        large 
          ? "text-4xl md:text-5xl lg:text-6xl" 
          : "text-3xl md:text-4xl lg:text-5xl"
      }`}>
        {title}{" "}
        {highlight && <span className="text-gradient">{highlight}</span>}
      </h2>
      {description && (
        <p className={`mt-5 text-muted-foreground leading-relaxed ${
          center ? "mx-auto max-w-2xl" : "max-w-xl"
        } ${large ? "text-lg" : "text-base"}`}>
          {description}
        </p>
      )}
    </motion.div>
  );
};

export default SectionHeading;
