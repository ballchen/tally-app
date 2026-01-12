"use client"

import { useState, useRef, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Settings, RefreshCw, Archive, EyeOff, Trash2, ArchiveRestore, Eye, ImagePlus, X } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ImageCropDialog } from "@/components/ui/image-crop-dialog"
import { useUpdateGroup, useArchiveGroup, useDeleteGroup, useHideGroup, useUploadGroupCover } from "@/hooks/use-groups"
import { toast } from "sonner"

const formSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  baseCurrency: z.string().min(3, "Currency code must be 3 characters").max(3),
})

interface EditGroupDialogProps {
  group: {
    id: string
    name: string
    base_currency: string
    invite_code: string
    created_by: string | null
    archived_at: string | null
    cover_image_url: string | null
  }
  currentUserId: string
  isHidden?: boolean
}

export function EditGroupDialog({ group, currentUserId, isHidden = false }: EditGroupDialogProps) {
  const [open, setOpen] = useState(false)
  const [coverPreview, setCoverPreview] = useState<string | null>(group.cover_image_url)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const updateGroup = useUpdateGroup()
  const archiveGroup = useArchiveGroup()
  const deleteGroup = useDeleteGroup()
  const hideGroup = useHideGroup()
  const uploadCover = useUploadGroupCover()

  const isOwner = group.created_by === currentUserId
  const isArchived = !!group.archived_at

  // Reset cover preview when dialog opens
  useEffect(() => {
    if (open) {
      setCoverPreview(group.cover_image_url)
    }
  }, [open, group.cover_image_url])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: group.name,
      baseCurrency: group.base_currency,
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    setSelectedImageSrc(objectUrl)
    setCropDialogOpen(true)
    e.target.value = ""
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (selectedImageSrc) {
      URL.revokeObjectURL(selectedImageSrc)
    }
    setSelectedImageSrc(null)

    const croppedFile = new File([croppedBlob], "cover.jpg", { type: "image/jpeg" })
    const previewUrl = URL.createObjectURL(croppedBlob)
    setCoverPreview(previewUrl)

    try {
      console.log('Starting group cover upload...')
      const publicUrl = await uploadCover.mutateAsync({ groupId: group.id, file: croppedFile })
      console.log('Group cover upload successful, new URL:', publicUrl)
      
      // Clean up preview URL
      URL.revokeObjectURL(previewUrl)
      
      // Set the new public URL with cache buster
      setCoverPreview(publicUrl)
      
      // Force a small delay to ensure the image is ready
      await new Promise(resolve => setTimeout(resolve, 500))

      // Auto-save cover image
      await updateGroup.mutateAsync({ groupId: group.id, coverImageUrl: publicUrl })
      toast.success("Cover image updated!")
    } catch (error) {
      console.error("Group cover upload failed:", error)
      // Clean up preview URL on error
      URL.revokeObjectURL(previewUrl)
      setCoverPreview(group.cover_image_url)
      toast.error("Failed to upload cover image")
    }
  }

  const handleRemoveCover = async () => {
    try {
      await updateGroup.mutateAsync({ groupId: group.id, coverImageUrl: null })
      setCoverPreview(null)
      toast.success("Cover image removed!")
    } catch (error) {
      console.error("Failed to remove cover", error)
      toast.error("Failed to remove cover image")
    }
  }

  const handleCropDialogClose = (open: boolean) => {
    setCropDialogOpen(open)
    if (!open && selectedImageSrc) {
      URL.revokeObjectURL(selectedImageSrc)
      setSelectedImageSrc(null)
    }
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    updateGroup.mutate(
      {
        groupId: group.id,
        name: values.name,
        baseCurrency: values.baseCurrency,
      },
      {
        onSuccess: () => {
          setOpen(false)
          toast.success("Group updated!")
        },
        onError: (error) => {
          toast.error("Failed to update group")
          console.error(error)
        },
      }
    )
  }

  function handleRegenerateInviteCode() {
    updateGroup.mutate(
      {
        groupId: group.id,
        regenerateInviteCode: true,
      },
      {
        onSuccess: () => {
          toast.success("Invite code regenerated!")
        },
        onError: (error) => {
          toast.error("Failed to regenerate invite code")
          console.error(error)
        },
      }
    )
  }

  function handleArchive() {
    archiveGroup.mutate(
      { groupId: group.id, archive: !isArchived },
      {
        onSuccess: () => {
          toast.success(isArchived ? "Group unarchived!" : "Group archived!")
          setOpen(false)
        },
        onError: (error) => {
          toast.error(`Failed to ${isArchived ? "unarchive" : "archive"} group`)
          console.error(error)
        },
      }
    )
  }

  function handleHide() {
    hideGroup.mutate(
      { groupId: group.id, hide: !isHidden },
      {
        onSuccess: () => {
          toast.success(isHidden ? "Group unhidden!" : "Group hidden from your list!")
          setOpen(false)
          if (!isHidden) {
            router.push("/groups")
          }
        },
        onError: (error) => {
          toast.error(`Failed to ${isHidden ? "unhide" : "hide"} group`)
          console.error(error)
        },
      }
    )
  }

  function handleDelete() {
    deleteGroup.mutate(group.id, {
      onSuccess: () => {
        toast.success("Group deleted!")
        setOpen(false)
        router.push("/groups")
      },
      onError: (error) => {
        toast.error("Failed to delete group")
        console.error(error)
      },
    })
  }

  const isPending = updateGroup.isPending || archiveGroup.isPending || deleteGroup.isPending || hideGroup.isPending || uploadCover.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Group Settings</DialogTitle>
            <DialogDescription>
              {isArchived
                ? "This group is archived and read-only."
                : "Update group settings. Changes to currency may affect balance calculations."}
            </DialogDescription>
          </DialogHeader>

          {/* Cover Image Section */}
          {isOwner && !isArchived && (
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div
                className="relative w-full h-32 rounded-lg border-2 border-dashed border-muted-foreground/25 overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {coverPreview ? (
                  <>
                    <img
                      key={coverPreview}
                      src={coverPreview}
                      alt="Group cover"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Cover image load error:', e)
                      }}
                      onLoad={() => {
                        console.log('Cover image loaded successfully:', coverPreview)
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ImagePlus className="h-8 w-8 text-white" />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveCover()
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    {uploadCover.isPending && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 text-white animate-spin" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ImagePlus className="h-8 w-8 mb-2" />
                    <span className="text-sm">Click to add cover image</span>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Show cover preview for non-owners */}
          {!isOwner && coverPreview && (
            <div className="w-full h-32 rounded-lg overflow-hidden">
              <img
                src={coverPreview}
                alt="Group cover"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isArchived || !isOwner} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="baseCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Currency</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isArchived || !isOwner} />
                    </FormControl>
                    <FormDescription>
                      Changing currency will affect how balances are displayed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Invite Code</FormLabel>
                <div className="flex items-center gap-2">
                  <Input value={group.invite_code} disabled className="font-mono" />
                  {isOwner && !isArchived && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleRegenerateInviteCode}
                      disabled={isPending}
                    >
                      {updateGroup.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Regenerating will invalidate the old invite link
                </p>
              </div>

              {isOwner && !isArchived && (
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {updateGroup.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </DialogFooter>
              )}
            </form>
          </Form>

          <Separator className="my-4" />

          {/* Danger Zone */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>

            {/* Hide/Unhide - Available to all members */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {isHidden ? "Unhide Group" : "Hide Group"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isHidden
                    ? "Show this group in your active list"
                    : "Hide this group from your list (personal)"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleHide}
                disabled={isPending}
              >
                {hideGroup.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isHidden ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Archive/Unarchive - Owner only */}
            {isOwner && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {isArchived ? "Unarchive Group" : "Archive Group"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isArchived
                      ? "Restore this group to active status"
                      : "Make this group read-only for all members"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchive}
                  disabled={isPending}
                >
                  {archiveGroup.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isArchived ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            {/* Delete - Owner only */}
            {isOwner && (
              <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-destructive">Delete Group</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete this group and all its data
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Group?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete <strong>{group.name}</strong> and all its expenses, settlements, and member data. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {deleteGroup.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Crop Dialog */}
      {selectedImageSrc && (
        <ImageCropDialog
          open={cropDialogOpen}
          onOpenChange={handleCropDialogClose}
          imageSrc={selectedImageSrc}
          onCropComplete={handleCropComplete}
          aspectRatio={16 / 9}
          cropShape="rect"
        />
      )}
    </>
  )
}
