"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useAuthStore } from "@/store/useAuthStore";
import { useGroups, type GroupFilter } from "@/hooks/use-groups";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { ProfileSettingsDialog } from "@/components/profile/profile-settings-dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, LogOut, Users, Archive, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PushNotificationManager } from "@/components/pwa/push-notification-manager";
import { useRealtimeGroups } from "@/hooks/use-realtime-sync";

export default function GroupsPage() {
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<GroupFilter>("active");
  const { data: groups, isLoading } = useGroups(filter);
  const { data: allGroups } = useGroups("all"); // Fetch all groups to check counts
  const supabase = createClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [navigatingGroupId, setNavigatingGroupId] = useState<string | null>(
    null
  );

  // Enable realtime sync for groups list
  useRealtimeGroups();

  // Calculate counts for each filter
  const archivedCount = allGroups?.filter((g) => !!g.archived_at).length || 0;
  const hiddenCount =
    allGroups?.filter((g) => g.group_members?.some((m: any) => m.hidden_at))
      .length || 0;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleGroupClick = (groupId: string) => {
    setNavigatingGroupId(groupId);
    startTransition(() => {
      router.push(`/groups/${groupId}`);
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col max-w-2xl mx-auto">
      {/* Fixed Header / Navbar */}
      <header className="flex-shrink-0 sticky top-0 z-50 px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left: App Title */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl overflow-hidden shadow-md relative">
              <Image
                src="/icon-192x192.png"
                alt="Tally Logo"
                width={36}
                height={36}
                className="object-cover"
                priority
              />
            </div>
            <h1 className="text-xl font-semibold">Tally</h1>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            <PushNotificationManager />
            <ProfileSettingsDialog />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Logout"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Fixed Controls Bar */}
      <div className="flex-shrink-0 sticky top-[73px] z-40 px-4 pb-3 space-y-3">
        {/* Section Title + Create Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-muted-foreground">
            My Groups
          </h2>
          {filter === "active" && <CreateGroupDialog />}
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-muted rounded-lg p-1 w-fit">
          <button
            className={`px-3 py-1.5 text-sm rounded-md transition-all ${
              filter === "active"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground"
            }`}
            onClick={() => setFilter("active")}
          >
            Active
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1 ${
              filter === "archived"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground"
            }`}
            onClick={() => setFilter("archived")}
          >
            <Archive className="h-3.5 w-3.5" />
            Archived
            {archivedCount > 0 && (
              <span className="ml-1 text-xs opacity-60">({archivedCount})</span>
            )}
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1 ${
              filter === "hidden"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground"
            }`}
            onClick={() => setFilter("hidden")}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Hidden
            {hiddenCount > 0 && (
              <span className="ml-1 text-xs opacity-60">({hiddenCount})</span>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Groups List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-1 gap-4 pb-6">
          {groups?.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                  {filter === "active" && <Users className="h-10 w-10" />}
                  {filter === "archived" && <Archive className="h-10 w-10" />}
                  {filter === "hidden" && <EyeOff className="h-10 w-10" />}
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    {filter === "active" && "No groups yet"}
                    {filter === "archived" && "No archived groups"}
                    {filter === "hidden" && "No hidden groups"}
                  </h3>
                  <p className="text-sm max-w-sm">
                    {filter === "active" &&
                      "Create your first group to start splitting bills with friends!"}
                    {filter === "archived" &&
                      "Archived groups will appear here"}
                    {filter === "hidden" && "Hidden groups will appear here"}
                  </p>
                </div>
                {filter === "active" && <CreateGroupDialog />}
              </div>
            </Card>
          ) : (
            groups?.map((group) => {
              const isArchived = !!group.archived_at;
              const isHidden = group.group_members?.some(
                (m: any) => m.hidden_at
              );
              const allMembers = (group as any).all_members || [];
              const memberCount = allMembers.length;
              const displayMembers = allMembers.slice(0, 3); // Show max 3 avatars

              return (
                <Card
                  key={group.id}
                  className={`glass-card relative cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-150 active:scale-[0.98] active:opacity-80 touch-manipulation ${
                    isArchived ? "opacity-75" : ""
                  } ${
                    navigatingGroupId === group.id
                      ? "opacity-60 scale-[0.98]"
                      : ""
                  }`}
                  onClick={() => handleGroupClick(group.id)}
                  onTouchStart={(e) => {
                    // Add haptic feedback on touch devices
                    e.currentTarget.style.transform = "scale(0.98)";
                    e.currentTarget.style.opacity = "0.8";
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.opacity = "";
                  }}
                >
                  {navigatingGroupId === group.id && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-lg backdrop-blur-sm z-10">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="flex-1">{group.name}</CardTitle>
                      {isArchived && (
                        <Badge variant="secondary" className="text-xs">
                          <Archive className="h-3 w-3 mr-1" />
                          Archived
                        </Badge>
                      )}
                      {isHidden && (
                        <Badge variant="outline" className="text-xs">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Hidden
                        </Badge>
                      )}
                    </div>

                    {/* Members Row */}
                    <div className="flex items-center justify-between gap-3 pt-2">
                      {/* Member Avatars */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center -space-x-1.5">
                          {displayMembers.map((member: any, idx: number) => (
                            <Avatar
                              key={member.user_id || idx}
                              className="h-7 w-7 border-[1.5px] border-background shadow-sm"
                              style={{ zIndex: displayMembers.length - idx }}
                            >
                              <AvatarImage src={member.profiles?.avatar_url} />
                              <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-medium">
                                {member.profiles?.display_name?.[0]?.toUpperCase() ||
                                  "?"}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {memberCount > 3 && (
                            <div
                              className="h-7 w-7 rounded-full border-[1.5px] border-background bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center shadow-sm"
                              style={{ zIndex: 0 }}
                            >
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                +{memberCount - 3}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground font-medium">
                          {memberCount}{" "}
                          {memberCount === 1 ? "member" : "members"}
                        </span>
                      </div>

                      {/* Currency Badge */}
                      <Badge variant="outline" className="text-xs font-mono">
                        {group.base_currency}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
