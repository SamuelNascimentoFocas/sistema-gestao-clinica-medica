import User from '#models/user'

export async function createBearerToken(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}
