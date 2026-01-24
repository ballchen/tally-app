"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";

const REMEMBER_ME_KEY = "tally_remember_me";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const supabase = createClient();
  const { setUser } = useAuthStore();
  const t = useTranslations("Auth");
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [tab, setTab] = React.useState<"login" | "register">("login");
  const [rememberMe, setRememberMe] = React.useState(false);
  const [showLoginPassword, setShowLoginPassword] = React.useState(false);
  const [showSignupPassword, setShowSignupPassword] = React.useState(false);

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, t("password") + " " + t("loginFailed")), // Simplification for validation msg
  });
  
  const signupSchema = z.object({
    name: z.string().min(2, t("displayName") + "..."),
    email: z.string().email(),
    password: z.string().min(6),
  });

  // Login Form
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Load saved credentials on mount
  React.useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_ME_KEY);
    if (saved) {
      try {
        const { email, password } = JSON.parse(saved);
        loginForm.setValue("email", email || "");
        loginForm.setValue("password", password || "");
        setRememberMe(true);
      } catch {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
    }
  }, [loginForm]);

  // Signup Form
  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSignIn(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      toast.error(t("loginFailed"), {
        description: error.message,
      });
      setIsLoading(false);
      return;
    }

    if (data.user) {
      // Handle remember me
      if (rememberMe) {
        localStorage.setItem(
          REMEMBER_ME_KEY,
          JSON.stringify({ email: values.email, password: values.password })
        );
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      setUser(data.user);
      toast.success(t("welcomeBack"));
      router.push(next || "/");
    }
    setIsLoading(false);
  }

  async function onSignUp(values: z.infer<typeof signupSchema>) {
    setIsLoading(true);

    // Build redirect URL with 'next' parameter preserved
    const redirectUrl = new URL("/auth/callback", window.location.origin);
    if (next) {
      redirectUrl.searchParams.set("next", next);
    }

    // Step 1: Sign up
    const { data: signupData, error: signupError } = await supabase.auth.signUp(
      {
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.name,
          },
          emailRedirectTo: redirectUrl.toString(),
        },
      }
    );

    if (signupError) {
      toast.error(t("signupFailed"), {
        description: signupError.message,
      });
      setIsLoading(false);
      return;
    }

    if (signupData.user) {
      // Check if email confirmation is required
      const needsConfirmation = signupData.user.identities?.length === 0;

      if (needsConfirmation) {
        // Email confirmation required
        toast.success(t("accountCreated"), {
          description: t("checkEmail"),
          duration: 10000,
        });
        setTab("login");
        loginForm.setValue("email", values.email);
        setIsLoading(false);
        return;
      }

      // Step 2: Auto-login after signup (if no confirmation needed)
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

      if (loginError) {
        // If auto-login fails, show success but ask to login manually
        toast.success(t("accountCreated"), {
          description: t("signInToContinue"),
        });
        setTab("login");
        loginForm.setValue("email", values.email);
        setIsLoading(false);
        return;
      }

      if (loginData.user) {
        setUser(loginData.user);
        toast.success(t("welcomeUser", { name: values.name }));
        router.push(next || "/");
      }
    }
    setIsLoading(false);
  }

  return (
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
        <CardTitle className="text-2xl text-center">{t("welcomeTitle")}</CardTitle>
        <CardDescription className="text-center">
          {t("welcomeDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={tab}
          onValueChange={(v: string) => setTab(v as "login" | "register")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">{t("login")}</TabsTrigger>
            <TabsTrigger value="register">{t("signUp")}</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Form {...loginForm}>
              <form
                onSubmit={loginForm.handleSubmit(onSignIn)}
                className="space-y-4"
              >
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("email")}</FormLabel>
                      <FormControl>
                        <Input placeholder="m@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>{t("password")}</FormLabel>
                        <Link
                          href="/forgot-password"
                          className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                        >
                          {t("forgotPassword")}
                        </Link>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showLoginPassword ? "text" : "password"}
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showLoginPassword ? (
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
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) =>
                      setRememberMe(checked === true)
                    }
                  />
                  <label
                    htmlFor="remember-me"
                    className="text-sm text-muted-foreground cursor-pointer select-none"
                  >
                    {t("rememberMe")}
                  </label>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("signIn")}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="register">
            <Form {...signupForm}>
              <form
                onSubmit={signupForm.handleSubmit(onSignUp)}
                className="space-y-4"
              >
                <FormField
                  control={signupForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("displayName")}</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signupForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("email")}</FormLabel>
                      <FormControl>
                        <Input placeholder="m@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signupForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("password")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showSignupPassword ? "text" : "password"}
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignupPassword(!showSignupPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showSignupPassword ? (
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
                  {t("createAccount")}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
