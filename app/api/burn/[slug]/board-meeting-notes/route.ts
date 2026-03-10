import { requestWithMembership } from "@/app/api/_common/endpoints";
import { JWT } from "google-auth-library";
import { google } from "googleapis";

const FOLDER_ID = "1RQlZFh6q_0vgnVuKbia7ZtRoplOw6egq";
const DRIVE_USER = "board@theborderland.se";

export const GET = requestWithMembership(
  async (_supabase, _profile, _request, _body, _project) => {
    const email = process.env.GCP_CLIENT_EMAIL;
    const key = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!email || !key) {
      throw new Error(
        "GCP_CLIENT_EMAIL and GCP_PRIVATE_KEY must be configured",
      );
    }

    const auth = new JWT({
      email,
      key,
      subject: DRIVE_USER,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    const drive = google.drive({ version: "v3", auth });
    const { data } = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, webViewLink)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: "name",
    });

    const files = (data.files || []).filter(f => f.mimeType === "application/pdf").map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    }));

    return { data: files };
  },
);
