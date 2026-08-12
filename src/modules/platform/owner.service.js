import * as authService from "../auth/auth.service.js";
import * as registrationService from "../onboarding/registration.service.js";
import * as analyticsService from "./analytics.service.js";
import * as supportService from "../support/support.service.js";

export async function login(credentials, ipAddress) {
  return authService.loginPlatformOwner(credentials, ipAddress);
}

export async function me(userId) {
  return authService.mePlatformOwner(userId);
}

export async function listRegistrations(q) {
  return registrationService.listRegistrations(q);
}

export async function getRegistration(id) {
  return registrationService.getRegistrationById(id);
}

export async function getMetrics() {
  return analyticsService.getMetrics();
}

export async function listDealerships(query) {
  return analyticsService.listDealerships(query);
}

export async function listSupportMessages(query) {
  return supportService.listSupportMessages(query);
}

export async function updateSupportMessage(id, status) {
  return supportService.updateSupportMessageStatus(id, status);
}
