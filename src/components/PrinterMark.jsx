export default function PrinterMark({ className = '' }) {
  return (
    <div className={`flex items-center justify-center rounded-md bg-green-700 text-white ${className}`}>
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path
          d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-3a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3a2 2 0 0 1-2 2h-2M7 14h10v6H7v-6Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path d="M17 12h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
