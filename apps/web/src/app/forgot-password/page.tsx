"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
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
import { useTranslations } from "next-intl";

export default function ForgotPasswordPage() {
  const t = useTranslations("ForgotPassword");
  const forgotPasswordSchema = z.object({
    email: z.string().email(t("invalidEmail")),
  });
  const supabase = createClient();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isEmailSent, setIsEmailSent] = React.useState(false);

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof forgotPasswordSchema>) {
    setIsLoading(true);

    // Redirect directly to reset-password page
    // Supabase will append hash fragment with access_token
    const redirectUrl = new URL("/reset-password", window.location.origin);

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: redirectUrl.toString(),
    });

    if (error) {
      toast.error(t("sendFailed"), {
        description: error.message,
      });
      setIsLoading(false);
      return;
    }

    setIsEmailSent(true);
    toast.success(t("sentTitle"), {
      description: t("sentDescription"),
    });
    setIsLoading(false);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
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
            {isEmailSent ? t("checkEmailTitle") : t("title")}
          </CardTitle>
          <CardDescription className="text-center">
            {isEmailSent ? t("checkEmailDescription") : t("description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEmailSent ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {t.rich("sentBody", {
                  email: () => <span className="font-medium">{form.getValues("email")}</span>,
                })}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsEmailSent(false)}
              >
                {t("sendAnother")}
              </Button>
              <Link href="/login" className="block">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("backToLogin")}
                </Button>
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("sendLink")}
                </Button>
                <Link href="/login" className="block">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("backToLogin")}
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
