import { useAuth } from '../context/AuthContext.jsx';
import PoweredByFooter from './PoweredByFooter.jsx';
import PrinterMark from './PrinterMark.jsx';

export default function LoginScreen() {
  const { config, login } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <section className="panel p-8">
            <div className="flex items-center gap-3">
              <PrinterMark className="h-10 w-10" />
              <div>
                <h1 className="text-xl font-semibold text-slate-950">{config.appName}</h1>
                <p className="text-sm text-slate-500">Sign in to continue</p>
              </div>
            </div>

            <button className="button-primary mt-8 w-full" onClick={login} type="button">
              {config.loginButtonText}
            </button>
          </section>
        </div>
      </main>
      <PoweredByFooter />
    </div>
  );
}
