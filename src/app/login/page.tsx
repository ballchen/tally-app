import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 md:p-10 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-secondary/20 -z-10" />
      
      <div className="w-full max-w-md z-10 animate-fade-in-up">
        <LoginForm />
      </div>
    </div>
  )
}
