---
id: faastjs.limits
title: Limits interface
hide_title: true
---
[faastjs](./faastjs.md) &gt; [Limits](./faastjs.limits.md)

## Limits interface

Specify [throttle()](./faastjs.throttle.md) limits. These limits shape the way throttle invokes the underlying function.

<b>Signature:</b>

```typescript
export interface Limits 
```

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [burst](./faastjs.limits.burst.md) | <code>number</code> | The maximum number of calls to the underlying function to "burst" -- e.g. the number that can be issued immediately as long as the rate limit is not exceeded. For example, if rate is 5 and burst is 5, and 10 calls are made to the throttled function, 5 calls are made immediately and then after 1 second, another 5 calls are made immediately. Setting burst to 1 means calls are issued uniformly every <code>1/rate</code> seconds. If <code>rate</code> is not specified, then <code>burst</code> does not apply. Default: 1. |
|  [cache](./faastjs.limits.cache.md) | <code>PersistentCache</code> | Similar to <code>memoize</code> except the map from function arguments to results is stored in a persistent cache on disk. This is useful to prevent redundant calls to APIs which are expected to return the same results for the same arguments, and which are likely to be called across many faast.js module instantiations. This is used internally by faast.js for caching cloud prices for AWS and Google, and for saving the last garbage collection date for AWS. Persistent cache entries expire after a period of time. See [PersistentCache](./faastjs.persistentcache.md)<!-- -->. |
|  [concurrency](./faastjs.limits.concurrency.md) | <code>number</code> | The maximum number of concurrent executions of the underlying function to allow. Must be supplied, there is no default. Specifying <code>0</code> or <code>Infinity</code> is allowed and means there is no concurrency limit. |
|  [memoize](./faastjs.limits.memoize.md) | <code>boolean</code> | If <code>memoize</code> is <code>true</code>, then every call to the throttled function will be saved as an entry in a map from arguments to return value. If same arguments are seen again in a future call, the return value is retrieved from the Map rather than calling the function again. This can be useful for avoiding redundant calls that are expected to return the same results given the same arguments.<!-- -->The arguments will be captured with <code>JSON.stringify</code>, therefore types that do not stringify uniquely won't be distinguished from each other. Care must be taken when specifying <code>memoize</code> to ensure avoid incorrect results. |
|  [rate](./faastjs.limits.rate.md) | <code>number</code> | The maximum number of calls per second to allow to the underlying function. Default: no rate limit. |
|  [retry](./faastjs.limits.retry.md) | <code>number &#124; ((err: any, retries: number) =&gt; boolean)</code> | Retry if the throttled function returns a rejected promise. <code>retry</code> can be a number or a function. If it is a number <code>N</code>, then up to <code>N</code> additional attempts are made in addition to the initial call. If retry is a function, it should return <code>true</code> if another retry attempt should be made, otherwise <code>false</code>. The first argument will be the value of the rejected promise from the previous call attempt, and the second argument will be the number of previous retry attempts (e.g. the first call will have value 0). Default: 0 (no retry attempts). |