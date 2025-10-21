  export function makeTG(base: string) {
    let queue = Promise.resolve();
    const call = (method: string, body: any) => {
      queue = queue.then(async () => {
        for (;;) {
          const res = await fetch(`${base}/${method}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body)
          });
          const j = await res.json().catch(() => ({}));
          if (res.ok && j?.ok) return j.result;
          const retry = j?.parameters?.retry_after;
          if (res.status === 429 && retry) {
            await new Promise((r) => setTimeout(r, (retry + 1) * 1000));
            continue;
          }
          throw new Error(`TG ${method} ${res.status} ${JSON.stringify(j)}`);
        }
      });
      return queue;
    };
    return call;
  }
