import { useState, useActionState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../store';
import Input from './Input';
import Button from './Button';

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const [, submitAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const username = formData.get('username') as string;
      const password = formData.get('password') as string;

      if (!username || !password) {
        setError('Username and password are required');
        return;
      }

      try {
        setError(null);
        await login(username, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    },
    null
  );

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12"
      >
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-inverse">
              Simple File Manager
            </span>
          </div>

          {/* Tagline */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-inverse leading-tight mb-6">
              Manage your files with simplicity
            </h1>
            <p className="text-lg text-sidebar-text leading-relaxed">
              A lightweight, fast, and secure file management solution. 
              Upload, organize, and share files with ease.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-4">
          {[
            'Drag & drop file uploads',
            'Folder organization',
            'Public & private access control',
            'API access with tokens',
          ].map((feature, index) => (
            <motion.div
              key={feature}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="flex items-center gap-3 text-sidebar-text"
            >
              <div className="w-1.5 h-1.5 bg-primary" />
              <span className="text-sm">{feature}</span>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-xs text-sidebar-text/50">
          Powered by AlgoDomain Solutions
        </div>
      </motion.div>

      {/* Right Panel - Login Form */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-surface"
      >
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-foreground">
              Simple File Manager
            </span>
          </div>

          <div className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Sign in
            </h2>
            <p className="text-sm text-muted">
              Enter your credentials to access the file manager
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 mb-6 bg-danger-subtle text-danger text-sm border border-danger"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Login Form */}
          <form action={submitAction} className="space-y-8">
            <Input
              name="username"
              label="Username"
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
              disabled={isPending}
              icon={<User className="w-5 h-5" />}
            />

            <Input
              name="password"
              type="password"
              label="Password"
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={isPending}
              icon={<Lock className="w-5 h-5" />}
            />

            <div className="pt-6">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={isPending}
                icon={<ArrowRight className="w-4 h-4" />}
                iconPosition="right"
              >
                Sign in
              </Button>
            </div>
          </form>

          {/* Help text */}
          <p className="mt-10 text-center text-xs text-subtle">
            Default credentials: admin / admin123
          </p>
        </div>
      </motion.div>
    </div>
  );
}
