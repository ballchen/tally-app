import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export function useProfile() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (error) throw error
      return data
    }
  })

  const updateProfile = useMutation({
    mutationFn: async (updates: { display_name?: string; gender?: string; avatar_url?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user")

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    }
  })

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user")

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      // Upload with upsert to replace existing files
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '0',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      // Get public URL with cache busting parameter
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Add timestamp to prevent caching issues
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`
      
      console.log('Upload successful:', urlWithCacheBust)
      return urlWithCacheBust
    }
  })

  return {
    data: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateProfile,
    uploadAvatar
  }
}
