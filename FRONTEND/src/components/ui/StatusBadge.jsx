export const StatusBadge = ({ type, variant = "bg" }) => {
  const styles = {
    Unregistered: "bg-amber-100 text-amber-700",
    Registered: "bg-emerald-100 text-emerald-700",
    Approved: "text-blue-600",
    Denied: "text-rose-500",
    Entered: "text-emerald-500",
  };

  if (variant === "text") {
    return <span className={`font-bold text-sm ${styles[type] || 'text-slate-500'}`}>{type}</span>;
  }

  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${styles[type] || 'bg-slate-100 text-slate-600'}`}>
      {type}
    </span>
  );
};