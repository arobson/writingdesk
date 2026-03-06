import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  githubId: integer('github_id').notNull().unique(),
  login: text('login').notNull(),
  avatarUrl: text('avatar_url').notNull(),
  // GitHub OAuth access token — encrypted with TOKEN_SECRET before storage
  accessToken: text('access_token').notNull(),
  createdAt: text('created_at').notNull(),
})

export const blogs = sqliteTable('blogs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  repoName: text('repo_name').notNull(),
  repoOwner: text('repo_owner').notNull(),
  pagesUrl: text('pages_url'),  // set once GitHub Pages activates
  createdAt: text('created_at').notNull(),
})

export type User = typeof users.$inferSelect
export type Blog = typeof blogs.$inferSelect
export type NewUser = typeof users.$inferInsert
export type NewBlog = typeof blogs.$inferInsert
