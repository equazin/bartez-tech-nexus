interface SectionHeadingProps {
  badge?: string;
  title: string;
  highlight?: string;
  description?: string;
  center?: boolean;
}

const SectionHeading = ({ badge, title, highlight, description, center = true }: SectionHeadingProps) => {
  return (
    <div className={`mb-12 ${center ? "text-center" : ""}`}>
      {badge && (
        <span className="mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-primary">
          {badge}
        </span>
      )}
      <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
        {title}{" "}
        {highlight && <span className="text-gradient">{highlight}</span>}
      </h2>
      {description && (
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
};

export default SectionHeading;
