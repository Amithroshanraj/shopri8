import {
  approveRetailerApplication,
  fetchRetailerApplication,
  fetchRetailerApplications,
  isFirebaseActive,
  rejectRetailerApplication,
  submitRetailerApplication,
} from "../firebase";
import type {
  RetailerApplication,
  RetailerApplicationInput,
  RetailerApplicationStatus,
} from "../types";
import { runWhenActive, type RepositoryResult } from "./types";

export const retailerApplicationRepository = {
  get(applicantUid: string): Promise<RepositoryResult<RetailerApplication | null>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchRetailerApplication(applicantUid),
      "Could not load your retailer application.",
    );
  },

  list(status?: RetailerApplicationStatus): Promise<RepositoryResult<RetailerApplication[]>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchRetailerApplications(status),
      "Could not load retailer applications.",
    );
  },

  submit(applicantUid: string, input: RetailerApplicationInput): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => submitRetailerApplication(applicantUid, input),
      "Retailer applications require Firebase mode.",
    );
  },

  approve(applicantUid: string, reviewerUid: string): Promise<RepositoryResult<string>> {
    return runWhenActive(
      isFirebaseActive,
      () => approveRetailerApplication(applicantUid, reviewerUid),
      "Retailer approvals require Firebase mode.",
    );
  },

  reject(
    applicantUid: string,
    reviewerUid: string,
    reason: string,
  ): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => rejectRetailerApplication(applicantUid, reviewerUid, reason),
      "Retailer rejections require Firebase mode.",
    );
  },
};
