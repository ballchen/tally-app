"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2, CheckCircle2, ArrowLeft, AlertCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isSessionReady, setIsSessionReady] = React.useState(false);
  const [sessionError, setSessionError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Handle the recovery token from URL hash on mount
  React.useEffect(() => {
    const handleRecoveryToken = async () => {
      // Check if there's already a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsSessionReady(true);
        return;
      }

      // Check for hash params (Supabase sends tokens via hash fragment)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      if (type === "recovery" && accessToken) {
        // Set the session using the recovery tokens
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

        if (error) {
          setSessionError("Invalid or expired reset link. Please request a new one.");
          return;
        }

        // Clear the hash from URL for security
        window.history.replaceState(null, "", window.location.pathname);
        setIsSessionReady(true);
      } else {
        // No valid recovery token found
        setSessionError("Invalid reset link. Please request a new password reset.");
      }
    };

    handleRecoveryToken();
  }, [supabase.auth]);

  async function onSubmit(values: z.infer<typeof resetPasswordSchema>) {
    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      toast.error("Failed to reset password", {
        description: error.message,
      });
      setIsLoading(false);
      return;
    }

    setIsSuccess(true);
    toast.success("Password reset successfully!");
    setIsLoading(false);

    // Redirect to home after a short delay
    setTimeout(() => {
      router.push("/");
    }, 2000);
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md glass-card border-none shadow-xl ring-1 ring-white/20 dark:ring-white/10">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg relative">
              <Image
                src="/icon-192x192.png"
                alt="Tally Logo"
                width={64}
                height={64}
                className="object-cover"
                priority
              />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            {isSuccess ? "Password Reset!" : "Reset Password"}
          </CardTitle>
          <CardDescription className="text-center">
            {isSuccess
              ? "Your password has been updated successfully"
              : "Enter your new password below"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionError ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {sessionError}
              </p>
              <Link href="/forgot-password" className="block">
                <Button className="w-full">Request New Reset Link</Button>
              </Link>
              <Link href="/login" className="block">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : !isSessionReady ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isSuccess ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Redirecting you to the app...
              </p>
              <Link href="/" className="block">
                <Button className="w-full">Continue to App</Button>
              </Link>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Reset Password
                </Button>
                <Link href="/login" className="block">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
