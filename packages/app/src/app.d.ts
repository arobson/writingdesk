declare global {
  namespace App {
    interface Locals {
      user: {
        githubUserId: number
        login: string
        avatarUrl: string
        role: 'author' | 'publisher'
      } | null
    }
    interface PageData {}
    interface Error {}
    interface Platform {}
  }
}

export {}
