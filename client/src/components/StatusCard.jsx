/**
 * components/StatusCard.jsx
 *
 * What this file does:
 *   A reusable status card that can display one of three states for any
 *   service: loading, ok, or error.
 *
 * How it fits into BuildProof:
 *   App.jsx uses two of these cards — one for the backend and one for Docker.
 *   Because it's a separate component, we can easily add more cards later
 *   (e.g., "Scanner ready", "Sample project loaded").
 *
 * Props:
 *   title   {string}              - The name of the service, e.g. "Backend"
 *   state   {"loading"|"ok"|"error"} - Which visual style to apply
 *   message {string}              - The main status message to display
 *   detail  {string}  (optional)  - A smaller line of extra info
 */

export default function StatusCard({ title, state, message, detail }) {
  // --- Choose styles based on state ---
  // We always show both a color AND a word label, so color-blind users are
  // not left out (accessibility best practice).

  const styles = {
    loading: {
      card: 'border-gray-600 bg-gray-800/50',
      badge: 'bg-gray-700 text-gray-300',
      label: 'Checking...',
      dot: 'bg-gray-400',
    },
    ok: {
      card: 'border-green-700 bg-green-950/40',
      badge: 'bg-green-800 text-green-200',
      label: 'Connected',
      dot: 'bg-green-400',
    },
    error: {
      card: 'border-red-700 bg-red-950/40',
      badge: 'bg-red-800 text-red-200',
      label: 'Problem',
      dot: 'bg-red-400',
    },
  };

  // Fall back to loading styles if an unrecognised state is passed in
  const s = styles[state] ?? styles.loading;

  return (
    <div className={`rounded-xl border p-5 ${s.card} transition-all duration-300`}>
      {/* Card header: title on the left, status badge on the right */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>

        {/* Status badge — color + word */}
        <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${s.badge}`}>
          {/* Colored dot */}
          <span className={`h-2 w-2 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>

      {/* Main message */}
      <p className="text-gray-300 text-sm">{message}</p>

      {/* Optional detail line (e.g. Docker version) */}
      {detail && (
        <p className="text-gray-500 text-xs mt-1">{detail}</p>
      )}
    </div>
  );
}
