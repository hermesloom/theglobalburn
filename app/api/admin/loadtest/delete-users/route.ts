import { requestWithAuthAdmin } from "@/app/api/_common/endpoints";
import { SupabaseClient } from "@supabase/supabase-js";
import { formatDuration } from "../_common/utils";

async function deleteUser(supabase: SupabaseClient, verbose: boolean, id: string, email: string): Promise<number> {
  var errorCount = 0;
  const resp = await supabase.from('profiles').delete().eq('id', id);
  if (resp.error) {
    errorCount++;
    console.log(resp.error);
  }

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) {
    errorCount++;
    console.log(error);
  } else if (verbose) {
    console.log(`Deleted user: ${email}`);
  }

  return errorCount;
}

export const GET = requestWithAuthAdmin(async (supabase, _profile, request, _body) => {
  const verbose = request.nextUrl.searchParams.get("verbose") == "true" || false;
  const parallel = request.nextUrl.searchParams.get("parallel") == "true" || false;

  const { data, error } = await supabase.from('profiles').select('id,email').like('email', '%@load.test');
  if (error) {
    console.log(error);
  }
  if (data) {
    console.log(`Found ${data.length} users to delete`);

    const reducer = async (acc: Promise<number>, task: Promise<number>): Promise<number> => {
      try {
        const taskResult = await task;
        return taskResult + await acc;
      } catch (error) {
        console.log(error);
        return await acc;
      };
    }

    const startDeleteTime = performance.now();
    var errorCount = 0;
    if (parallel) {
      errorCount = await data.
        map((user) => deleteUser(supabase, verbose, user.id, user.email)).
        reduce(reducer, Promise.resolve(0));
    } else {
      for (let user of data) {
        errorCount += await deleteUser(supabase, verbose, user.id, user.email);
      }
    }
    const finishDeleteTime = performance.now();

    return {
      deleteTime: formatDuration(finishDeleteTime - startDeleteTime),
      errorCount: errorCount,
    };
  }
});
