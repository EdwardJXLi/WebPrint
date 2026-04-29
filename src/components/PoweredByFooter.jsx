import { useAuth } from '../context/AuthContext.jsx';

export default function PoweredByFooter() {
  const { config } = useAuth();

  if (!config.poweredByFooterEnabled) {
    return null;
  }

  return (
    <footer className="px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
      Powered by{' '}
      <a
        className="font-medium text-slate-700 underline-offset-2 transition hover:text-green-800 hover:underline"
        href="https://github.com/EdwardJXLi/WebPrint"
        rel="noreferrer"
        target="_blank"
      >
        WebPrint
      </a>
      {config.appVersion ? ` v${config.appVersion}` : ''}
    </footer>
  );
}
