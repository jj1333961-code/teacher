'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { registrationRequests } from '@/lib/db/schema'

export type RegistrationInput = {
  fullName: string
  phone: string
  subject: string
  experience: string
  region: string
  verificationMethod: 'google' | 'phone'
  phoneVerificationId?: string
}

export async function createRegistration(input: RegistrationInput) {
  const clean = {
    fullName: input.fullName.trim().slice(0, 120),
    phone: input.phone.replace(/[^0-9+]/g, '').slice(0, 20),
    subject: input.subject.trim().slice(0, 100),
    experience: input.experience.trim().slice(0, 100),
    region: input.region.trim().slice(0, 100),
  }
  if (Object.values(clean).some((value) => !value)) throw new Error('INVALID_INPUT')

  let userId = ''
  if (input.verificationMethod === 'google') {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) throw new Error('UNAUTHORIZED')
    userId = session.user.id
  } else {
    const id = input.phoneVerificationId?.trim() ?? ''
    if (!id || id.length > 100 || !id.startsWith('demo-phone-')) throw new Error('PHONE_NOT_VERIFIED')
    userId = id
  }

  const [request] = await db.insert(registrationRequests).values({
    userId,
    verificationMethod: input.verificationMethod,
    ...clean,
  }).returning({ id: registrationRequests.id })
  return request
}
