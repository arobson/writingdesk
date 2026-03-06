declare global {
  namespace App {
    interface Locals {
      user: {
        userId: number
        githubId: number
        login: string
        avatarUrl: string
      } | null
      // Set when the user has a blog — null during onboarding
      blog: {
        id: number
        repoOwner: string
        repoName: string
        pagesUrl: string | null
        token: string  // decrypted GitHub OAuth token
      } | null
    }
    interface PageData {}
    interface Error {}
    interface Platform {}
  }
}

export {}
