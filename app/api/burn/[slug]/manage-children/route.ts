import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { metadata } from "@/app/layout";
import { BurnRole, BurnStage } from "@/utils/types";
import { s } from "ajv-ts";
import { first, last } from "lodash";
const UpdateChildRequestSchema = s.object({
  key: s.string(),
  first_name: s.string(),
  last_name: s.string(),
  dob: s.string(),
});
export const PATCH = requestWithProject<
  s.infer<typeof UpdateChildRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    
    var newMetaData = project?.membership?.metadata;

    if (newMetaData["children"] == undefined) {
      newMetaData["children"] = []
    }
    newMetaData["children"].push(body);
    
    
    var result = await supabase.from("burn_memberships").update({ metadata: newMetaData }).eq("id", project!.membership!.id);

    console.log(result);

  }, UpdateChildRequestSchema, undefined);

/*
   await supabase.from("burn_membership_purchase_rights").insert({
     project_id: project!.id,
     owner_id: profile!.id,
     expires_at: new Date(
       new Date().getTime() +
         project?.burn_config.open_sale_reservation_duration! * 1000
     ).toISOString(),
     is_low_income: false,
     details_modifiable: true,
   });
 },
 undefined,
 BurnRole.Participant
 */

