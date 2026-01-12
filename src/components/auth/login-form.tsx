"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const supabase = createClient();
  const { setUser } = useAuthStore();
  const [isLoading, setIsLoading] = React.useState(false);
  const [tab, setTab] = React.useState<"login" | "register">("login");

  // Login Form
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

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
      toast.error("Login failed", {
        description: error.message,
      });
      setIsLoading(false);
      return;
    }

    if (data.user) {
      setUser(data.user);
      toast.success("Welcome back!");
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
      toast.error("Signup failed", {
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
        toast.success("Account created!", {
          description: "Please check your email to verify your account",
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
        toast.success("Account created!", {
          description: "Please sign in to continue",
        });
        setTab("login");
        loginForm.setValue("email", values.email);
        setIsLoading(false);
        return;
      }

      if (loginData.user) {
        setUser(loginData.user);
        toast.success(`Welcome, ${values.name}!`);
        router.push(next || "/");
      }
    }
    setIsLoading(false);
  }

  return (
    <Card className="w-full max-w-md glass-card border-none shadow-xl ring-1 ring-white/20 dark:ring-white/10">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg">
            <img
              src="/icon-192x192.png"
              alt="Tally Logo"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Welcome to Tally</CardTitle>
        <CardDescription className="text-center">
          Split bills with friends, easily.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={tab}
          onValueChange={(v: string) => setTab(v as any)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Sign Up</TabsTrigger>
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
                      <FormLabel>Email</FormLabel>
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Sign In
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
                      <FormLabel>Display Name</FormLabel>
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
                      <FormLabel>Email</FormLabel>
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Account
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
