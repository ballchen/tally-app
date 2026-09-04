import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query"
import { safeGetUser } from "../lib/auth-helpers"
import { useSupabase } from "../supabase-context"

export type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  gender: string | null
  default_currency: string | null
  [key: string]: unknown
}

export type ProfileUpdate = {
  display_name?: string
  gender?: string
  avatar_url?: string
}

export function useUploadAvatar(): UseMutationResult<string, Error, File> {
  const supabase = useSupabase()

  return useMutation({
    mutationFn: async (file: File) => {
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) throw new Error("No user")

      const fileExt = file.name.split(".").pop()
      const filePath = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { cacheControl: "0", upsert: true })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath)

      // Cache-busting query keeps a replaced avatar from showing the stale image.
      return `${publicUrl}?t=${Date.now()}`
    },
  })
}

export type UseProfileResult = {
  data: Profile | null | undefined
  isLoading: boolean
  updateProfile: UseMutationResult<void, Error, ProfileUpdate>
  uploadAvatar: UseMutationResult<string, Error, File>
}

export function useProfile(): UseProfileResult {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  const profileQuery: UseQueryResult<Profile | null, Error> = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) return null

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (error) throw error
      return data as Profile
    },
  })

  const updateProfile = useMutation<void, Error, ProfileUpdate>({
    mutationFn: async (updates) => {
      const { user, error: authError } = await safeGetUser(supabase)
      if (authError) throw authError
      if (!user) throw new Error("No user")

      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
  })

  const uploadAvatar = useUploadAvatar()

  return {
    data: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateProfile,
    uploadAvatar,
  }
}
