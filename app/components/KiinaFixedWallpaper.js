"use client";

import { usePathname } from "next/navigation";

const WALLPAPER = "data:image/webp;base64,UklGRhwNAABXRUJQVlA4IBANAABQaACdASpAATkCPwF4tFYrNCqto9IaIoAgCWUtqMX05bRoemqDBhKJae/EhUHD33P7hv5TfbrMt5RlTHGQgAVIvB8sZOEXK9wBz2vxJRivW27UVD7IDp5j0gJhqkrsgd5dfc1q9Wo7HBMIIkSv2W6ajxtAXUq+cbfpGbtBb4S0rwNJRBqIz/js6eXCNbG2riJlMycOlDAT34vAzMzQBjWTAI0ANWY3gEH1KUVMgX+V3y7ZUnCT5ZJnDn0jJqBKGKq/bVUay+6dOn7eBVkaPM2qDMfJTV2RS0p8ogBK5+kw9ePOBeH1CqWMe6Vb5FpvAJIqKiYra0L9tAzffo9/M+mEbq48mUx24PuKYF6Grmg56m8RcVyDAuNq6/xw2jkML9mQ+DrFhTLiJX5n/H79HxZfTeUHO/rvge72oGgDB8sY9+j/H5pMXUu+2Ftp5TEplPVOP8NmcMXzYN9YTOLW5r0EZ/bsdrQg/ndAIdLakeqQawxS+uLTejnW6LxUfg/ecMmnqKqEA8FU9LzVBuM2wDajM9W7altVRrowUYn1gBHKTegBa+0Q0j8xOOlrQbUp+UWlqBrgqHkHso2jq67QE0+5IF8DHzjcsnQ5UfUYue5NtcsgEPzHVj+WfxYgiF4RXQWL+Nf9XlJ/giKVjLDQ39Kr9PJAzsPUw6WpY12FIZ/yDBfTtQksmlHKiLI3j/LuGLa9roy4ChaGIstgnKh/uyN49bomYMr6BjzGZn+3O5GyQKu+kFCpnTsv5JAZ4jHw27A2p8IomA44WQ0K+QLEtP0Zh9gbQZeCwCxc2GrJxCIBIkFIn8NJfG+ndMVbQTSXFznu8M33uJTcejoFLi7iJ1rnl+nQEH8fNL51KV8SEwDnck1GGylrHqrsmydAebFI1PAoN+Ewy40q2hHR9BD0f9VNY9Hq5RWnIuxVr0urne7Jh8A/arQczy+cFKT9O8Jrr8fmAaoqx5/hi0/OKHO+aw0VoxNq2hdgSl8bPETktpUiEyu8UD+6JZiJAvfUiRpAAE6+IHQKjY7wUexTjMUT0w+3Xso1lUNodepGHKAgcSN+fNv8hx+j57gPx3Em+MDi7BWeGwqHkpsADJ0AcT5R+OmJetzDJkgcGq0cgoAA/vAsh3Y6G1dm8WexHoRjqwNacv+YpLSA/Hd04sBMhnnBro++cjhxBYu4QRppC8m+56bxNhQOn6jkyMeH20h4ovZpOf0mF2dGScteJ0e/eSFUIANTobgUzZzvFtLcuVJom2S2PUw4HxPNprNg2PPlYFyswMYgH4uttYlRB6DX3iPxls2QZ/L/dR3KunQPM2dqB72SIpwLpX4kguNG7k4iKVpFBxGO4VNbMc6YUiDgEajsV28QXjrZGCLjEjzi5wcBp9sE3s1EVPwIMoUHqetWRcM13MTdWmiNM8a9aa5XdP3u8dAz/Efj2VFWzgEXve7KryOYi7sbUwZdt3i29d4zCs5oneOI9tUYpIAUG+uGAf54NgOl4gGWJ2XVAIw3i6k+UIOmz0LrvAuOoaEYYjk2+nEEWdJqgk7CR5xt6SICtyjy5MA1qzVN9ZCFikhcqZE0n/xNDmMfhVGCC5QACqKvYO97qnYMm6PiYW4LticCS36CfxNMZbT2WxroJq9c2js4aVyiJ1V80Qce3TqofEhNhu9yPS3nEk03xKVrJCorpXn/4tm4IXZwrwadVg6XQpmpO4YjJKT6eE3QG4F7atSkuU7TUWIIEB2V64vtyBrRZbX8m8wXNnNQV4AIdtWsarhrgvAWsfQzYK4VCmyxrt7QRwQr13EBRyVyH7xfQqBxIfTgAAAwIi8gjOXHap0CnwxS6wr7lTZyTB6+a5rp3Sg9l2uB5yKBHVuzU9eekIQ/3nhcrBjrK/YyaK3Wk1dAZyuQD5oeG5p8is3eqEoD914TGk06P3CIE534LGibXOLJRA9lF0+nr95pPnnCk2Z4sqLYWRApFrk8OCptVGQi+O1p4m2Gx4boLnz15TIaFBYjKS3Br5ukIYoJvjMgHEopl98alvXkDxZH2M3oV3qAz043pcEwBSqM+boxD0AMX1gCI9Bp2vqXbd3tVo301o9P+Z8+/FbWnb6tiBz6kY9GUngH4DFj7nm1XehIiGcwxxqf/RDpveA5h461H1F8ii7LQtljU2B6hQmtI3wOEou/d+0iplBuaAAAD2z1nfR8u8zYkUrRsVcOrevDqh9tSg6YP5uCxF2Ny9gXNGSo9Cgyg3nKcTahNoqlQ9eIa1M2JkhPGQBfq1nYQ9e7qDFf5Z7QB2aCO125ciZR8v8sdHGO2xNSNRAACf4AK8LmecR/djj/EtGklAmsLqrmddk+/bngriB563BoqN10MJGA9s4xgtsa0x9wnVnPgABYnVhYmztwQyLuobo/jhXq1n0nvanehpFBOU+EWFmSLTQlChzyzZ+FbQb6ACVZhaAALUia1V+RoTBdmRTT8YbcqolqjyKbmboicyCA4kQxI4AMrR4jokyZkSC1eFjuTXUABg4SvMSuy9m0fF1DjfngpObDZ3MnUFZOWksBU7gEkTm1oiI7pDdo2n2QBlqF91KSk+ycOCmrSrxqdiewDEzqbpwkLTXkyVd8oO+B934GJsjE2JUttCWZXDMmWaJywC3sHiyR6We+NEloiVlwKDWTpfIKghVb/I+nNg49W5VQWXQcGGgUNncAtEIrzJrgV0HKXNR0mpa2wUd/SkG3oQ7T863WA+8m5Dkcz4PfuCVpuU0dL24XQ6w6aazWBkJFyQM/gYqIcu1MGlJXC+oTnIk60EMHmUPj/7dE4lUZWrF2pTYSS0y4pOEbjD8ts5gXDrdGG1Bs4oIjguaLWUOp/pzDOk8XXdH36MAUBAe5Poh1MOGVTjP5KF7YYj1YT4Adm2x8Skn6xpJV4tI4jxf+a0nUPs/tLyQTh3e7txGCTFRwBF6KlYDOdptbtNpZYcb7sD3kfa4dHrbUfQ3bAAAPCwl+by9xXh00b2pRxRqB1hHtF5eaKKLwhw2GsWiTOZiKDb5mMUTKyEjwFub63njBWKH5Nsv6eQlNOYjTPePmg7wnaL/nQZ/2ed9yQ3oAoU3YaCxxcnyPSAnWve0YtgjY9Zmbm56bH2pAAALTLuBjrBYA7hrewLhtL3HVyDA4JKe6YwT2sRv+Oskm8Sa00lmNIZQFGfj+PaAF9aB8cVvxwAi2JjTfcTWVohBjk6B1jTOieHCZPIr/dLfm6b/biVrOW3vadGLNZgACN2AaxWwZ/Z84nq+vU3BZL760OBWqdRi2A5nyPNTNEgTSKgrLmaLMhcoEihp6XxUJQe+tUgno08ruNJ+MQV/TuBiE1SQCkiR12/NOlsq2YcfdT1Fot4iPrnt/K/zCMj+kYPIETUHXkQ9sjSMIhd21jWUOBXVlicnRAOmK9nQIIQMo9ZDGkXhGyFgKuL//vx+zawKaUUANjGRbZHZ3RmuULgmzy9URhHCdhfSMRkKGuflVbIXTWld7kPq/wnrz7pMaYMl5TzRtQi8mHpZYA9Sccry9SV8FJwqt4yE95kg00zeN/sdK9sP6i+HkawOeG0nac0yurV2rSSDWcpfuj58sAXmSKSpfcDfxMlMKZ3JbkvhDtdUc6WYUQybRFahDD/zqXF6xQqNTNANiUAcGd8v2mTMsyqUiWlfK7XDXfhXn42luoQpdG2jrP3vk6w8Qdc4ozt/TUonXaOx+ufkL5gjMyvCzggmTT2AsXkBKh8iEAS8BKAlH+6FErnO/9xGk2uwWF9vh4jD0qf5/3+RMxnJecNYHQoOC0MdH2a8nwmy/yw7vQguEeaMgIqjSsW1tK7zmWDuRUAQFfS5CA3xncyWwI4GthecTRffeYHKUgUxgWuHYRb7OPHDnSyN0/X8GdpaNaDCXl6RRujIEz7/VexaLRkx4ZJRJQN3E/hqhe9Ha+lqllnpg88Lv16JWsYYWs3SkfWFth7LxkMidoiwQT0jr3/+WHazJfXTFzK4poJDaz/k+c6yCNqf40LXzWcteGPFWg2ACGZ8gJgNxqofLr3eILq/A+JEWKR5H3/iO/QJ6zBz9lkqYE3BWNWZHoRSG7vQparyEddSK+B0P1zvM/2WxVLGUQCDEPOMA8Egl+TcXQmhLzU56tdMmta8s/cd1X28Hcab9SNobjf9+5ImONR2MPQG5RjKrwCzVgelpkTwtL2xVCnkYjVURya/1e9Mi7XYyy0Eb8ZL+0XfuT4jNGTUB3bfnmFLuwTkGwj9COHP0hdL8Gm2dCsbJyzl2K05CD3UWVQPt43nknPS8uuiI+P9cAkTn8Hg7FIUNyGUlfP2DzCIu9U9akmBRZ8MxwqyUPTAL6kOM9CEf3lGmFmKpdwsT/i9HX/TEHEyb/iZRZu6fTR0SgpUUSi3yQiIwZjUGf4Cy/MIam6c35ZzOgHVkWnG9hv93Cm+zyhstTb6QV5bWSpNLgjwPeK4qygp1LA/wJMtlo7dNKL6gAA==";

export default function KiinaFixedWallpaper() {
  const pathname = usePathname();
  if (pathname !== "/kiina") return null;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundColor: "#fff7df",
          backgroundImage: `url(${WALLPAPER})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center center",
          backgroundSize: "cover",
        }}
      />
      <style>{`
        body:has(.kiinaPage) {
          background: #fff7df !important;
        }

        .kiinaPage {
          position: relative !important;
          z-index: 1;
          background: transparent !important;
        }
      `}</style>
    </>
  );
}
