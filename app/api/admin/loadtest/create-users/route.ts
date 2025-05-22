import { requestWithAuthAdmin } from "@/app/api/_common/endpoints";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { formatDuration } from "../_common/utils";

type UserData = {
  index: number,
  name: string,
  password: string,
  email: string,
  user: User | null,
};

async function createUser(supabase: SupabaseClient, verbose: boolean, user: UserData): Promise<UserData> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
  });
  if (error) {
    console.log(error);
  } else {
    if (verbose) {
      console.log(`created user ${user.index}: ${data.user.email}`);
    }
    user.user = data.user;
  }
  return user;
}
export const GET = requestWithAuthAdmin(async (supabase, _profile, request, _body) => {
  const numUsers = parseInt(request.nextUrl.searchParams.get("num_users") ?? "10");
  const verbose = request.nextUrl.searchParams.get("verbose") == "true" || false;
  const parallel = request.nextUrl.searchParams.get("parallel") == "true" || false;

  const users: UserData[] = [];

  console.log("initializing users...");
  for (let i = 0; i < numUsers; i++) {
    const userName = `${i}`;
    const password = userName;
    const email = `${userName}@load.test`
    const user = {
      index: i,
      name: userName,
      password: password,
      email: email,
      user: null,
    };
    users.push(user);
  }

  const startCreateTime = performance.now();
  var createdUsers = [];
  if (parallel) {
    console.log("creating users in parallel...");
    createdUsers = await Promise.all(users.map((user) => createUser(supabase, verbose, user)));
  } else {
    console.log("creating users sequentially...");
    for (let user of users) {
      createdUsers.push(await createUser(supabase, verbose, user));
      if ((user.index + 1) % 10 == 0) {
        console.log(`created ${user.index + 1} users`);
      }
    }
  }
  const finishCreateTime = performance.now();

  return {
    createTime: formatDuration(finishCreateTime - startCreateTime),
    errorCount: createdUsers.map((user): number => user.user === null ? 1 : 0).reduce((acc, value) => acc + value),
  };
})
