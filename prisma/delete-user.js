import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const EMAIL = "noumandev1221@gmail.com";

async function main() {
  console.log(`Looking up user: ${EMAIL}`);

  const user = await prisma.user.findFirst({
    where: { email: EMAIL },
    include: { dealership: true },
  });

  if (!user) {
    console.log(`User "${EMAIL}" not found. Nothing to delete.`);
    return;
  }

  console.log(`\nFound user:`);
  console.log(`  ID:       ${user.id}`);
  console.log(`  Name:     ${user.fullName}`);
  console.log(`  Role:     ${user.role}`);
  console.log(`  Active:   ${user.isActive}`);
  console.log(`  Deleted:  ${user.deletedAt ? "yes (soft-deleted)" : "no"}`);
  console.log(`  Dealership: ${user.dealership ? user.dealership.name + " (" + user.dealership.id + ")" : "N/A"}`);

  if (user.role === "platform_owner") {
    console.log(`\n⚠  WARNING: This is a platform_owner account.`);
    console.log(`   Deleting it is destructive. Proceeding anyway...`);
  }

  const userId = user.id;
  const dealershipId = user.dealershipId;

  // ── Step 1: Cancel Stripe subscription if the user owns a dealership ──
  if (dealershipId && user.dealership?.stripeSubscriptionId) {
    try {
      const { stripe } = await import("../src/lib/stripe.js");
      if (stripe) {
        const subId = user.dealership.stripeSubscriptionId;
        console.log(`\nCancelling Stripe subscription: ${subId}`);
        await stripe.subscriptions.cancel(subId);
        console.log(`  Stripe subscription cancelled.`);
      }
    } catch (err) {
      console.error(`  Failed to cancel Stripe subscription: ${err.message}`);
    }
  }

  // ── Step 2: Delete invitations sent by this user (before nullifying) ──
  const invSentCount = await prisma.invitation.count({ where: { invitedById: userId } });
  if (invSentCount > 0) {
    console.log(`\nDeleting ${invSentCount} invitation(s) sent by this user...`);
    await prisma.invitation.deleteMany({ where: { invitedById: userId } });
    console.log(`  Invitations deleted.`);
  }

  // ── Step 3: Nullify all nullable FK references to this user ──
  console.log(`\nNullifying foreign key references...`);

  const nullifyOps = [
    prisma.$executeRawUnsafe(`UPDATE vehicles SET created_by_id = NULL WHERE created_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE customers SET created_by_id = NULL WHERE created_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE customers SET sales_rep_id = NULL WHERE sales_rep_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE deals SET sales_rep_id = NULL WHERE sales_rep_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE deals SET created_by_id = NULL WHERE created_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE deal_jackets SET sales_rep_id = NULL WHERE sales_rep_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE deal_jackets SET reviewed_by_id = NULL WHERE reviewed_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE deal_jacket_activity SET actor_id = NULL WHERE actor_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE conversations SET created_by_id = NULL WHERE created_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE calendar_events SET created_by_id = NULL WHERE created_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE cpa_notes SET created_by_id = NULL WHERE created_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE cpa_notes SET assigned_to_id = NULL WHERE assigned_to_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE cpa_note_comments SET user_id = NULL WHERE user_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE cpa_note_attachments SET uploaded_by = NULL WHERE uploaded_by = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE files SET uploaded_by_id = NULL WHERE uploaded_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE sales_rep_commissions SET paid_by_id = NULL WHERE paid_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE audit_logs SET changed_by_id = NULL WHERE changed_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE vehicle_status_history SET changed_by_id = NULL WHERE changed_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE pricing_history SET changed_by_id = NULL WHERE changed_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE vehicle_expenses SET created_by_id = NULL WHERE created_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE flooring_plans SET created_by_id = NULL WHERE created_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE dealership_expenses SET created_by_id = NULL WHERE created_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE calendar_day_notes SET updated_by_id = NULL WHERE updated_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE customer_notes SET created_by_id = NULL WHERE created_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE customer_documents SET created_by_id = NULL WHERE created_by_id = $1`, userId),
    prisma.$executeRawUnsafe(`UPDATE payroll_runs SET created_by_id = NULL WHERE created_by_id = $1`, userId),
  ];

  await prisma.$transaction(nullifyOps);
  console.log(`  All nullable references set to NULL.`);

  // ── Step 4: Delete messages sent by this user (required FK) ──
  const msgCount = await prisma.message.count({ where: { senderId: userId } });
  if (msgCount > 0) {
    console.log(`\nDeleting ${msgCount} message(s) sent by this user...`);
    // Reads & reactions on these messages are cascade-deleted by Prisma/PostgreSQL
    await prisma.message.deleteMany({ where: { senderId: userId } });
    console.log(`  Messages deleted.`);
  }

  // ── Step 5: Delete SalesRepCommission where user is the sales rep (required FK) ──
  const commCount = await prisma.salesRepCommission.count({ where: { salesRepId: userId } });
  if (commCount > 0) {
    console.log(`\nDeleting ${commCount} commission record(s) for this user...`);
    await prisma.salesRepCommission.deleteMany({ where: { salesRepId: userId } });
    console.log(`  Commissions deleted.`);
  }

  // ── Step 6: Delete the user (cascades to refresh_tokens, password_reset_tokens,
  //            sales_rep_profiles, notifications, conversation_members, message_reads,
  //            message_reactions, conversation_sessions, user_presence, typing_status,
  //            notification_queue) ──
  console.log(`\nDeleting user record...`);
  await prisma.user.delete({ where: { id: userId } });
  console.log(`  User deleted.`);

  console.log(`\n✓ User "${EMAIL}" has been completely removed from the database.`);
}

main()
  .catch((e) => {
    console.error("\nFailed to delete user:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
