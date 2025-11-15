import { requestWithAuthAdmin } from "@/app/api/_common/endpoints";
import { SupabaseClient } from "@supabase/supabase-js";
import { formatDuration } from "../_common/utils";
import { getProfile } from "@/app/api/_common/profile";

type UserStats = {
  samples: number[],
};

async function getProfileForUser(supabase: SupabaseClient, verbose: boolean, id: string, rampupSeconds: number, runUntil: number, sleepSeconds: number): Promise<UserStats> {
  const sleepMillis = sleepSeconds / 1000;
  var samples: number[] = [];

  // Wait for a random initial delay
  const initialIdleSeconds = Math.random() * rampupSeconds;
  await new Promise(resolve => setTimeout(resolve, initialIdleSeconds));

  while (performance.now() < runUntil) {
    const startTime = performance.now();
    const profile = await getProfile(supabase, id);
    const durationMs = performance.now() - startTime;
    if (verbose) {
      console.log(`${profile.email}: ${formatDuration(durationMs)}`);
    }
    samples.push(durationMs);
    await new Promise(resolve => setTimeout(resolve, sleepMillis));
  }

  return {
    samples: samples,
  };
}

export const GET = requestWithAuthAdmin(async (supabase, _profile, request, _body) => {
  const runDuration = parseFloat(request.nextUrl.searchParams.get("run_duration") ?? "5.0");
  const sleepDuration = parseFloat(request.nextUrl.searchParams.get("sleep_duration") ?? "1.0");
  const rampupDuration = parseFloat(request.nextUrl.searchParams.get("rampup_duration") ?? "2.0");
  const numUsers = parseInt(request.nextUrl.searchParams.get("num_users") ?? "0");
  const verbose = request.nextUrl.searchParams.get("verbose") == "true" || false;

  const { data, error } = await supabase.from('profiles').select('id,email').like('email', '%@load.test');
  if (error) {
    console.log(error);
  }
  if (data) {
    console.log(`Found ${data.length} load test users`);

    var users = data;
    if (numUsers != 0) {
      console.log(`Limiting to ${numUsers} load test users`);
      users = data.slice(0, numUsers);
    }

    const reducer = async (accPromise: Promise<UserStats>, userStatsPromise: Promise<UserStats>): Promise<UserStats> => {
      try {
        const userStats = await userStatsPromise;
        return await accPromise.then((acc) => {
          acc.samples.push(...userStats.samples);
          return acc;
        });
      } catch (error) {
        console.log(error);
        return await accPromise;
      };
    }

    const startTime = performance.now();
    const runUntil = startTime + (rampupDuration + runDuration) * 1000;
    const allSamples = await users.map((user) => getProfileForUser(supabase, verbose, user.id, rampupDuration, runUntil, sleepDuration)).reduce(reducer, Promise.resolve({ samples: [] }));

    var min = Number.MAX_VALUE;
    var max = 0;
    var sum = 0;
    for (let sample of allSamples.samples) {
      sum += sample;
      if (sample < min) {
        min = sample;
      }
      if (sample > max) {
        max = sample;
      }
    }

    return {
      min: formatDuration(min),
      max: formatDuration(max),
      avg: formatDuration(sum / allSamples.samples.length),
    }
  }
})
