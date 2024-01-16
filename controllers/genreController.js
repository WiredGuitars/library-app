const Genre = require("../models/genre");
const asyncHandler = require("express-async-handler");
const Book = require("../models/book");
const { body, validationResult } = require("express-validator");
const Bookinstance = require("../models/bookinstance");

// Display list of all Genre.
exports.genre_list = function (req, res, next) {
  Genre.find()
    .sort({ name: 'asc' })
    .exec()
    .then((list_genres) => {
      // Successful, so render
      res.render('genre_list', { title: 'Genre List', genre_list: list_genres });
    })
    .catch((err) => {
      return next(err);
    });
};

// Display detail page for a specific Genre.
exports.genre_detail = asyncHandler(async (req, res, next) => {
  // Get details of genre and all associated books (in parallel)
  const [genre, booksInGenre] = await Promise.all([
    Genre.findById(req.params.id).exec(),
    Book.find({ genre: req.params.id }, "title summary").exec(),
  ]);
  if (genre === null) {
    // No results.
    const err = new Error("Genre not found");
    err.status = 404;
    return next(err);
  }

  res.render("genre_detail", {
    title: "Genre Detail",
    genre: genre,
    genre_books: booksInGenre,
  });
});


// Display Genre create form on GET.
exports.genre_create_get = (req, res, next) => {
  res.render("genre_form", { title: "Create Genre" });
};

// Handle Genre create on POST.
exports.genre_create_post = [
  // Validate and sanitize the name field.
  body("name", "Genre name must contain at least 3 characters")
    .trim()
    .isLength({ min: 3 })
    .escape(),

  // Process request after validation and sanitization.
  asyncHandler(async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    // Create a genre object with escaped and trimmed data.
    const genre = new Genre({ name: req.body.name });

    if (!errors.isEmpty()) {
      // There are errors. Render the form again with sanitized values/error messages.
      res.render("genre_form", {
        title: "Create Genre",
        genre: genre,
        errors: errors.array(),
      });
      return;
    } else {
      // Data from form is valid.
      // Check if Genre with same name already exists.
      const genreExists = await Genre.findOne({ name: req.body.name }).exec();
      if (genreExists) {
        // Genre exists, redirect to its detail page.
        res.redirect(genreExists.url);
      } else {
        await genre.save();
        // New genre saved. Redirect to genre detail page.
        res.redirect(genre.url);
      }
    }
  }),
];


// Display Genre delete form on GET.
exports.genre_delete_get = asyncHandler(async (req, res, next) => {
  // Get genre and its associated books for confirmation.
  const [genre, genreBooks] = await Promise.all([
    Genre.findById(req.params.id),
    Book.find({ genre: req.params.id }).exec(),
  ]);

  if (!genre) {
    const err = new Error('Genre not found');
    err.status = 404;
    return next(err);
  }

  res.render('genre_delete', { title: 'Delete Genre', genre, genreBooks });
});

exports.genre_delete_post = asyncHandler(async (req, res, next) => {
  const genreId = req.body.genreid;

  // Find books associated with the genre
  const associatedBooks = await Book.find({ genre: genreId });

  // Extract book IDs
  const bookIds = associatedBooks.map(book => book._id);

  // Assume valid genre id, so no need for validation/sanitization.
  await Promise.all([
    // Remove the genre itself
    Genre.findByIdAndDelete(genreId),

    // Remove books associated with the genre.
    Book.deleteMany({ genre: { $in: [genreId] } }),

    // Remove book instances associated with the genre.
    Bookinstance.deleteMany({ book: { $in: bookIds } }),
  ]);

  // Redirect to genre list after deletion.
  res.redirect('/catalog/genres');
});




// Display Genre update form on GET.
exports.genre_update_get = asyncHandler(async (req, res, next) => {
  const genre = await Genre.findById(req.params.id).exec();

  if (genre === null) {
    const err = new Error("Genre not found");
    err.status = 404;
    return next(err);
  }

  // Render the update form with the current genre details.
  res.render("genre_form", { title: "Update Genre", genre });
});

// Handle Genre update on POST.
exports.genre_update_post = asyncHandler(async (req, res, next) => {
  const genre = new Genre({
    name: req.body.name,
    _id: req.params.id,
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.render("genre_form", { title: "Update Genre", genre, errors: errors.array() });
    return;
  }

  try {
    const updatedGenre = await Genre.findOneAndUpdate(
      { _id: req.params.id },
      genre,
      { new: true, runValidators: true }
    ).exec();

    res.redirect(updatedGenre.url);
  } catch (err) {
    return next(err);
  }
});
