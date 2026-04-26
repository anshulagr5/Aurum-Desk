export function SummaryRow({
  label,
  value,
  emphatic = false,
}: {
  label: string;
  value: string;
  emphatic?: boolean;
}) {
  return (
    <div className={emphatic ? "summary-row emphatic" : "summary-row"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
