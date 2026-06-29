export const config = {
  siteMeta: {
    title: "Whatever Dev Blog",
    teamName: "Whatever Co.",
    description: "Whatever Co. Dev Team Blog",
  },
  siteRoot:
    process.env.SITE_ORIGIN ||
    (process.env.NODE_ENV === "production"
      ? "https://dev-blog.whatever.co"
      : "http://localhost:3000"),
  headerLinks: [
    { title: "About", href: "/about" },
    { title: "Members", href: "/members" },
    { title: "RSS", href: "/feed.xml" },
  ],
};
