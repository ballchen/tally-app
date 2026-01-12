"use client"

import { useState, useRef, useEffect } from "react"
import { useProfile } from "@/hooks/use-profile"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ImageCropDialog } from "@/components/ui/image-crop-dialog"
import { Camera, Loader2, UserCog } from "lucide-react"

export function ProfileSettingsDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [gender, setGender] = useState("other")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: profile, isLoading, updateProfile, uploadAvatar } = useProfile()

  useEffect(() => {
    if (profile) {
      setName(profile.display_name || "")
      setGender(profile.gender || "other")
      setPreviewUrl(profile.avatar_url || null)
    }
  }, [profile])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Create object URL for cropping
    const objectUrl = URL.createObjectURL(file)
    setSelectedImageSrc(objectUrl)
    setPendingFile(file)
    setCropDialogOpen(true)

    // Reset input so same file can be selected again
    e.target.value = ""
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    // Clean up old object URL
    if (selectedImageSrc) {
      URL.revokeObjectURL(selectedImageSrc)
    }
    setSelectedImageSrc(null)
    setPendingFile(null)

    // Create a File from the Blob for upload
    const croppedFile = new File([croppedBlob], "avatar.jpg", {
      type: "image/jpeg",
    })

    // Show preview immediately
    const previewObjectUrl = URL.createObjectURL(croppedBlob)
    setPreviewUrl(previewObjectUrl)

    try {
      const publicUrl = await uploadAvatar.mutateAsync(croppedFile)
      // Clean up preview URL and use the real one
      URL.revokeObjectURL(previewObjectUrl)
      setPreviewUrl(publicUrl)
    } catch (error) {
      console.error("Upload failed", error)
      // Revert to previous avatar on error
      setPreviewUrl(profile?.avatar_url || null)
    }
  }

  const handleCropDialogClose = (open: boolean) => {
    setCropDialogOpen(open)
    if (!open && selectedImageSrc) {
      URL.revokeObjectURL(selectedImageSrc)
      setSelectedImageSrc(null)
      setPendingFile(null)
    }
  }

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        display_name: name,
        gender: gender,
        avatar_url: previewUrl || undefined,
      })
      setOpen(false)
    } catch (error) {
      console.error("Update failed", error)
    }
  }

  const isSaving = updateProfile.isPending || uploadAvatar.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <UserCog className="h-5 w-5 text-muted-foreground" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] glass-card border-none ring-1 ring-white/20">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your personal information.</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <div className="grid gap-6 py-4">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Avatar className="h-24 w-24 border-4 border-background shadow-xl ring-2 ring-primary/20">
                    <AvatarImage src={previewUrl || undefined} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-muted">
                      {name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                    <Camera className="text-white h-8 w-8" />
                  </div>
                  {uploadAvatar.isPending && (
                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                      <Loader2 className="text-white h-8 w-8 animate-spin" />
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
                <span className="text-xs text-muted-foreground">Click to change avatar</span>
              </div>

              {/* Name Input */}
              <div className="grid gap-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/50 dark:bg-black/50"
                />
              </div>

              {/* Gender Selection */}
              <div className="grid gap-2">
                <Label>Gender</Label>
                <RadioGroup value={gender} onValueChange={setGender} className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" />
                    <Label htmlFor="male">Male</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" />
                    <Label htmlFor="female">Female</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other">Other</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Crop Dialog */}
      {selectedImageSrc && (
        <ImageCropDialog
          open={cropDialogOpen}
          onOpenChange={handleCropDialogClose}
          imageSrc={selectedImageSrc}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          cropShape="round"
        />
      )}
    </>
  )
}
